# backend/app.py
import os
import uuid
import traceback
import json
import random
# --- Ensure timedelta is imported ---
from datetime import datetime, timezone, timedelta
# --- End Ensure ---
from flask import Flask, request, jsonify, send_from_directory
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt_identity,
    create_refresh_token, get_jwt, verify_jwt_in_request
)
from flask_cors import CORS
from flask_migrate import Migrate
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
import logging
from sqlalchemy.exc import IntegrityError, OperationalError, SQLAlchemyError
from functools import wraps

load_dotenv()

# --- Database and Utils Imports ---
try:
    from database import db, init_db, User, Material, Prompt, Quiz, Question, Choice, StudentQuizAttempt, StudentAnswer
    from utils import extract_text, summarize_text, generate_ai_response, construct_final_prompt, MAX_CHARS_FOR_QUIZ_CONTEXT
except ImportError as e:
    logging.critical(f"CRITICAL ERROR - Failed to import database or utils: {e}", exc_info=True)
    raise e
    
uri = os.getenv("DATABASE_URL", "")
# Normalize σε postgresql:// αν έρχεται ως postgres://
if uri.startswith("postgres://"):
    uri = uri.replace("postgres://", "postgresql://", 1)

# Αν η Render DB απαιτήσει SSL (κάποια setups), συμπλήρωσε:
# if "sslmode=" not in uri:
#     sep = "&" if "?" in uri else "?"
#     uri = f"{uri}{sep}sslmode=require"

app.config["SQLALCHEMY_DATABASE_URI"] = uri
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Προαιρετικό, βοηθά σε stale connections
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True}
print("Using DB:", app.config["SQLALCHEMY_DATABASE_URI"])


# --- Configure Logging ---
log_level = logging.DEBUG if os.getenv("FLASK_ENV") == 'development' else logging.INFO
logging.basicConfig(level=log_level, format='%(asctime)s %(levelname)-8s [%(filename)s:%(lineno)d] %(message)s')
logger = logging.getLogger(__name__)

# --- Initialize Flask App ---
app = Flask(__name__)
logger.info("Flask app initialized.")

# --- Flask Configuration ---
flask_secret = os.getenv("SECRET_KEY", "unsafe-default-flask-key")
jwt_secret = os.getenv("JWT_SECRET_KEY", "unsafe-default-jwt-key")
if flask_secret == "unsafe-default-flask-key": logger.critical("FLASK SECRET_KEY is insecure!")
if jwt_secret == "unsafe-default-jwt-key": logger.critical("JWT_SECRET_KEY is insecure!")

app.config["SECRET_KEY"] = flask_secret
app.config["JWT_SECRET_KEY"] = jwt_secret
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1) # timedelta is now defined
app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=30)
logger.info("Flask configuration loaded.")

# Upload Folder
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, os.getenv("UPLOAD_FOLDER", "storage/uploads"))
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024
logger.info(f"Upload folder configured: {UPLOAD_FOLDER}")

ALLOWED_EXTENSIONS = {'txt', 'pdf', 'ppt', 'pptx'}

# --- Initialize Extensions ---
try:
    init_db(app); logger.info("Database initialized via init_db.")
except Exception as e: logger.exception("CRITICAL ERROR - Failed during init_db")

jwt = JWTManager(app); logger.info("JWTManager initialized.")
allowed_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
CORS(app, resources={r"/api/*": {"origins": allowed_origins}}, supports_credentials=True); logger.info(f"CORS configured for origins: {allowed_origins}")
migrate = Migrate(app, db); logger.info("Flask-Migrate initialized.")

try:
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True); logger.info(f"Upload directory exists/created: {app.config['UPLOAD_FOLDER']}")
except OSError as e: logger.exception(f"CRITICAL ERROR - Could not create upload directory {app.config['UPLOAD_FOLDER']}")

# --- Helper Functions ---
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- JWT Loaders ---
@jwt.additional_claims_loader
def add_claims_to_access_token(identity):
     logger.debug(f"JWT Claims Loader received identity (user ID): {identity}")
     user = db.session.get(User, identity)
     if user: return {"role": user.role}
     logger.warning(f"JWT Claims Loader: User not found for ID {identity}"); return {}

# --- Before Request Hook ---
@app.before_request
def log_request_info():
    logger.debug(f"Request Received: {request.method} {request.path} from {request.remote_addr}")

# --- Demo routes: health, index, favicon ---
import os
from datetime import datetime, timezone
from flask import jsonify

@app.route("/healthz", methods=["GET", "HEAD"])
def healthz():
    # Απλό health check για το Render και για εσάς
    return {"ok": True}, 200

@app.route("/", methods=["GET"])
def index():
    # Μικρό JSON για να φαίνεται ότι "ζει" το service
    commit = os.environ.get("RENDER_GIT_COMMIT", "")[:7] or "dev"
    return jsonify({
        "ok": True,
        "service": "thesis-backend",
        "commit": commit,
        "ts": datetime.now(timezone.utc).isoformat()
    }), 200

@app.route("/favicon.ico")
def favicon():
    # Σταματά τα 404 του favicon στα logs
    return ("", 204)


# --- Error Handlers ---
@app.errorhandler(404)
def not_found_error(error):
    logger.warning(f"404 Not Found: {request.path}")
    return jsonify({"error": "Not Found"}), 404

@app.errorhandler(500)
def internal_error(error):
    try: db.session.rollback()
    except Exception: pass
    logger.exception(f"Internal Server Error Handler Caught: {error} for {request.method} {request.path}")
    return jsonify({"error": "An unexpected internal server error occurred."}), 500

@app.errorhandler(413)
def request_entity_too_large(error):
    logger.warning(f"413 Request Entity Too Large: {request.content_length} bytes for {request.path}")
    return jsonify({"error": f"File/Request too large. Max size: {app.config['MAX_CONTENT_LENGTH'] // (1024*1024)}MB."}), 413

@app.errorhandler(OperationalError)
def handle_operational_error(error):
     try: db.session.rollback()
     except Exception: pass
     logger.exception(f"Database Operational Error: {error.orig}")
     return jsonify({"error": "Database connection or operational error occurred."}), 503

@app.errorhandler(IntegrityError)
def handle_integrity_error(error):
    db.session.rollback()
    logger.warning(f"Database Integrity Error: {error.orig}")
    err_msg = str(error.orig).lower()
    if "unique constraint failed" in err_msg:
         email_attempt = "N/A";
         try: email_attempt = request.get_json().get('email', 'N/A')
         except Exception: pass
         if "user.email" in err_msg: logger.info(f"Duplicate email: {email_attempt}"); return jsonify({"error": "Email already exists."}), 409
         logger.warning(f"Generic unique constraint violation: {error.orig}")
         return jsonify({"error": "Identifier already exists."}), 409
    logger.error(f"Unhandled IntegrityError: {error.orig}")
    return jsonify({"error": "Database data conflict."}), 400

# --- Role Check Decorator ---
def require_role(role_name):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                verify_jwt_in_request()
                claims = get_jwt()
                user_role = claims.get("role")
                if user_role != role_name:
                    logger.warning(f"Role check FAILED: Required={role_name}, User={user_role}, Path={request.path}")
                    return jsonify({"error": f"Access forbidden: Requires '{role_name}' role."}), 403
                return fn(*args, **kwargs)
            except Exception as e:
                 logger.exception(f"Error during role check: {e}, Path={request.path}")
                 return jsonify({"error": "Authorization error occurred"}), 401
        return wrapper
    return decorator

# --- Authentication Routes ---
@app.route("/api/register", methods=["POST"])
def register():
    logger.info("--- /api/register ---")
    if not request.is_json: logger.warning("Not JSON"); return jsonify({"error": "Request must be JSON"}), 415
    data = request.get_json();
    if data is None: logger.warning("No JSON data"); return jsonify({"error": "Invalid JSON"}), 400
    email = data.get("email"); password = data.get("password"); role = data.get("role", "student")
    if role not in ['teacher', 'student']: role = 'student'
    if not email or not password: logger.warning("Missing email/pass"); return jsonify({"error": "Email/pass required"}), 400
    if len(password) < 6: logger.warning(f"Pass short: {email}"); return jsonify({"error": "Password min 6 chars"}), 400
    try:
        new_user = User(email=email, role=role); new_user.set_password(password)
        db.session.add(new_user); db.session.commit()
        logger.info(f"User registered: {email}, Role: {role}")
        return jsonify({"message": f"{role.capitalize()} registered successfully"}), 201
    except Exception as e:
        db.session.rollback(); logger.exception(f"ERROR during registration for {email}: {e}")
        return jsonify({"error": "Registration failed due to server error."}), 500

@app.route("/api/login", methods=["POST"])
def login():
    logger.info("--- /api/login ---")
    if not request.is_json:
        return jsonify({"error": "Το αίτημα πρέπει να είναι JSON"}), 415
    
    data = request.get_json()
    if data is None:
        return jsonify({"error": "Μη έγκυρα δεδομένα JSON"}), 400
    
    email = data.get("email")
    password = data.get("password")
    # Νέα παράμετρος: ο ρόλος που περιμένουμε από το frontend
    expected_role = data.get("role")

    logger.info(f"Attempting login for: {email} with expected role: {expected_role}")

    if not email or not password or not expected_role:
        return jsonify({"error": "Email, κωδικός πρόσβασης και ρόλος απαιτούνται"}), 400

    try:
        user = db.session.execute(db.select(User).filter_by(email=email)).scalar_one_or_none()
        
        if not user or not user.check_password(password):
            logger.warning(f"Invalid credentials for: {email}")
            return jsonify({"error": "Λάθος email ή κωδικός πρόσβασης"}), 401

        # **ΣΗΜΑΝΤΙΚΟΣ ΕΛΕΓΧΟΣ ΑΣΦΑΛΕΙΑΣ**
        # Ελέγχουμε αν ο ρόλος του χρήστη στη βάση ταιριάζει με τον ρόλο της φόρμας
        if user.role != expected_role:
            logger.warning(f"Role mismatch for user {email}. Expected: {expected_role}, Actual: {user.role}")
            return jsonify({"error": f"Δεν έχετε δικαιώματα σύνδεσης ως '{expected_role}'."}), 403 # Forbidden

        access_token = create_access_token(identity=user.id)
        logger.info(f"Login successful for {email} (Role: {user.role})")
        return jsonify(access_token=access_token)

    except Exception as e:
        logger.exception(f"ERROR during login process for {email}: {e}")
        return jsonify({"error": "Η σύνδεση απέτυχε λόγω σφάλματος διακομιστή."}), 500


@app.route("/api/user", methods=["GET"])
@jwt_required()
def get_user_info():
    logger.info("--- /api/user [GET] ---")
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        if not user: logger.warning(f"User not found: {user_id}"); return jsonify({"error": "User not found"}), 404
        logger.info(f"Returning info for {user.email}")
        return jsonify(user.to_dict()), 200
    except Exception as e:
        logger.exception(f"ERROR fetching user info: {e}")
        return jsonify({"error": "Failed to retrieve user information."}), 500

# --- Teacher Material Routes ---
@app.route("/api/materials", methods=["GET"])
@jwt_required()
@require_role("teacher")
def list_materials():
    logger.info("--- /api/materials [GET] ---")
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    # Ο έλεγχος ρόλου γίνεται πλέον από τον decorator
    logger.info(f"Listing materials for teacher {user_id}")
    try:
        return jsonify([m.to_dict() for m in sorted(user.materials, key=lambda m: m.uploaded_at, reverse=True)]), 200
    except Exception as e:
        logger.exception(f"Err list materials {user_id}")
        return jsonify({"error": "Αποτυχία φόρτωσης υλικών."}), 500

@app.route("/api/upload", methods=["POST"])
@jwt_required()
@require_role("teacher")
def upload_material():
    logger.info("--- /api/upload [POST] ---")
    user_id = get_jwt_identity()
    # Ο έλεγχος ρόλου γίνεται από τον decorator
    if 'file' not in request.files:
        return jsonify({"error": "Δεν επιλέχθηκε αρχείο"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Δεν επιλέχθηκε αρχείο"}), 400
    
    original_filename = secure_filename(file.filename)
    logger.info(f"Upload '{original_filename}' from {user_id}")

    if file and allowed_file(original_filename):
        unique_filename = f"{uuid.uuid4()}.{original_filename.rsplit('.', 1)[1].lower()}"
        relative_folder = os.getenv("UPLOAD_FOLDER", "storage/uploads")
        relative_filepath = os.path.join(relative_folder, unique_filename)
        full_filepath = os.path.join(BASE_DIR, relative_filepath)
        try:
            os.makedirs(os.path.dirname(full_filepath), exist_ok=True)
            file.save(full_filepath)
            logger.info(f"Saved to: {full_filepath}")

            extracted_text = extract_text(full_filepath, unique_filename)
            summary = summarize_text(extracted_text) if extracted_text else ""

            new_material = Material(user_id=user_id, filename=original_filename, filepath=relative_filepath, extracted_text=extracted_text, summary=summary)
            db.session.add(new_material)
            db.session.commit()
            logger.info(f"Material record created for {original_filename}")
            
            return jsonify(new_material.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            logger.exception(f"Error upload processing {original_filename}: {e}")
            if os.path.exists(full_filepath):
                 try:
                     os.remove(full_filepath)
                     logger.info(f"Cleaned up: {full_filepath}")
                 except OSError as rm_err:
                     logger.error(f"Cleanup failed {full_filepath}: {rm_err}")
            return jsonify({"error": "Αποτυχία επεξεργασίας του αρχείου."}), 500
    else:
        logger.warning(f"File type not allowed: {original_filename}")
        return jsonify({"error": "Ο τύπος αρχείου δεν επιτρέπεται"}), 400

@app.route("/api/materials/<string:material_id>", methods=["DELETE"])
@jwt_required()
@require_role("teacher")
def delete_material(material_id):
    logger.info(f"--- /api/materials/{material_id} [DELETE] ---")
    user_id = get_jwt_identity()
    # Ο έλεγχος ρόλου γίνεται από τον decorator
    try:
        material = db.session.execute(db.select(Material).filter_by(id=material_id, user_id=user_id)).scalar_one_or_none()
        if not material:
            return jsonify({"error": "Το υλικό δεν βρέθηκε ή δεν έχετε δικαίωμα πρόσβασης"}), 404
        
        full_filepath = os.path.join(BASE_DIR, material.filepath)
        material_name = material.filename
        
        if os.path.exists(full_filepath):
            os.remove(full_filepath)
            logger.info(f"Deleted file: {full_filepath}")

        db.session.delete(material)
        db.session.commit()
        logger.info(f"Deleted material record {material_name} ({material_id})")
        
        return jsonify({"message": "Το υλικό διαγράφηκε"}), 200
    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error deleting material {material_id}: {e}")
        return jsonify({"error": "Αποτυχία διαγραφής."}), 500
    
@app.route("/api/prompts", methods=["POST"])
@jwt_required()
@require_role("teacher")
def save_prompt():
    logger.info("--- /api/prompts [POST] ---")
    user_id = get_jwt_identity()
    data = request.get_json()
    name = data.get("name")
    structure = data.get("structure")
    description = data.get("description", "")
    is_public = bool(data.get("is_public", False))

    if not name or not structure:
        return jsonify({"error": "Name and structure required"}),400
    if not isinstance(structure, list):
        return jsonify({"error": "Structure must be list"}),400

    # Construct resolved system_prompt
    final_system_prompt, _ = construct_final_prompt(structure, "")
    if final_system_prompt.startswith("Error:"):
        return jsonify({"error":"Failed to process prompt structure."}),400

    try:
        new_prompt = Prompt(
            user_id=user_id,
            name=name,
            description=description,
            structure=structure,
            system_prompt=final_system_prompt,
            is_public=is_public
        )
        db.session.add(new_prompt)
        db.session.commit()
        return jsonify(new_prompt.to_dict(include_structure=False)),201
    except Exception as e:
        db.session.rollback()
        logger.exception("Error saving prompt")
        return jsonify({"error":"Failed to save prompt."}),500

@app.route("/api/prompts/<string:prompt_id>", methods=["PUT"])
@jwt_required()
@require_role("teacher")
def update_prompt(prompt_id):
    logger.info(f"--- /api/prompts/{prompt_id} [PUT] ---")
    user_id = get_jwt_identity()
    data = request.get_json()

    prompt = db.session.execute(
        db.select(Prompt).filter_by(id=prompt_id, user_id=user_id)
    ).scalar_one_or_none()
    if not prompt:
        return jsonify({"error":"Not found/auth"}),404

    name = data.get("name")
    if name is None:
        return jsonify({"error":"Name required"}),400
    prompt.name = name

    if "description" in data:
        prompt.description = data["description"]
    if "is_public" in data:
        prompt.is_public = bool(data["is_public"])

    if "structure" in data:
        structure = data.get("structure")
        if not isinstance(structure, list):
            return jsonify({"error":"Structure must be list"}),400
        prompt.structure = structure
        final_system_prompt, _ = construct_final_prompt(structure, "")
        if final_system_prompt.startswith("Error:"):
            return jsonify({"error":"Failed to process prompt structure."}),400
        prompt.system_prompt = final_system_prompt

    try:
        db.session.commit()
        return jsonify(prompt.to_dict(include_structure=False)),200
    except Exception as e:
        db.session.rollback()
        logger.exception("Error updating prompt")
        return jsonify({"error":"Failed to update prompt."}),500

@app.route("/api/prompts", methods=["GET"])
@jwt_required()
@require_role("teacher")
def list_teacher_prompts():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    prompts = sorted(user.prompts, key=lambda x:x.updated_at, reverse=True)
    return jsonify([p.to_dict(include_structure=False) for p in prompts]),200

@app.route("/api/prompts/<string:prompt_id>", methods=["GET"])
@jwt_required()
@require_role("teacher")
def get_teacher_prompt(prompt_id):
    user_id = get_jwt_identity()
    prompt = db.session.execute(
        db.select(Prompt).filter_by(id=prompt_id, user_id=user_id)
    ).scalar_one_or_none()
    if not prompt:
        return jsonify({"error":"Not found/auth"}),404
    data = prompt.to_dict(include_structure=True)
    data['system_prompt'] = prompt.system_prompt
    return jsonify(data),200

@app.route("/api/prompts/<string:prompt_id>", methods=["DELETE"])
@jwt_required()
@require_role("teacher")
def delete_prompt(prompt_id):
    user_id = get_jwt_identity()
    prompt = db.session.execute(
        db.select(Prompt).filter_by(id=prompt_id, user_id=user_id)
    ).scalar_one_or_none()
    if not prompt:
        return jsonify({"error":"Not found/auth"}),404
    db.session.delete(prompt)
    db.session.commit()
    return jsonify({"message":"Prompt deleted"}),200

# --- MODIFIED Teacher Sandbox Route ---
@app.route("/api/generate", methods=["POST"])
@jwt_required()
@require_role("teacher") # Ensure only teachers can use this
def generate_test_response():
    logger.info("--- /api/generate [POST] Teacher Sandbox ---")
    user_id = get_jwt_identity() # Correct way to get teacher's ID
    
    if not request.is_json:
        logger.warning("Sandbox: Request is not JSON")
        return jsonify({"error": "Request must be JSON"}), 415
    
    data = request.get_json()
    if data is None:
        logger.warning("Sandbox: No JSON data received")
        return jsonify({"error": "Invalid JSON data received."}), 400

    user_test_prompt = data.get("user_prompt")
    if not user_test_prompt:
        logger.warning("Sandbox: Missing user_prompt from payload")
        return jsonify({"error": "User test prompt is required"}), 400

    prompt_structure = data.get("prompt_structure") # Structure directly from canvas
    prompt_id_for_test = data.get("prompt_id")       # ID of a loaded (and possibly saved) prompt

    system_prompt_to_use = ""

    if prompt_structure and isinstance(prompt_structure, list) and len(prompt_structure) > 0:
        logger.info("Sandbox: Constructing system prompt from provided LIVE structure.")
        system_prompt_to_use, _ = construct_final_prompt(prompt_structure, "") # construct_final_prompt resolves material placeholders
        if system_prompt_to_use.startswith("Error:"):
            logger.error(f"Sandbox: Error constructing system prompt from live structure: {system_prompt_to_use}")
            return jsonify({"error": "Failed to process prompt structure for testing."}), 400
    elif prompt_id_for_test:
        logger.info(f"Sandbox: Using saved Prompt ID: {prompt_id_for_test} as structure might be empty/not primary.")
        # Ensure the prompt belongs to the current teacher for security
        prompt_obj = db.session.execute(
            db.select(Prompt).filter_by(id=prompt_id_for_test, user_id=user_id)
        ).scalar_one_or_none()

        if prompt_obj:
            # Use the pre-resolved system_prompt if available, otherwise construct it from its structure
            if prompt_obj.system_prompt:
                system_prompt_to_use = prompt_obj.system_prompt
                logger.info(f"Sandbox: Using stored system_prompt from Prompt ID {prompt_id_for_test}")
            elif prompt_obj.structure: # Fallback: construct from saved structure
                 logger.info(f"Sandbox: Reconstructing system_prompt from saved structure for Prompt ID {prompt_id_for_test}")
                 system_prompt_to_use, _ = construct_final_prompt(prompt_obj.structure, "")
                 if system_prompt_to_use.startswith("Error:"):
                    logger.error(f"Sandbox: Error reconstructing system prompt from saved structure {prompt_id_for_test}: {system_prompt_to_use}")
                    return jsonify({"error": "Failed to process saved prompt structure for testing."}), 400
            else:
                 logger.warning(f"Sandbox: Saved prompt {prompt_id_for_test} has no system_prompt or structure.")
                 return jsonify({"error": "Loaded prompt has no content to test."}), 400
        else:
            logger.warning(f"Sandbox: Prompt ID {prompt_id_for_test} not found or not owned by user {user_id}.")
            return jsonify({"error": "Prompt not found for testing."}), 404
    else:
        # This case should ideally not be reached if frontend ensures either structure or ID is sent
        # if blocks are present or a prompt is "loaded".
        logger.warning("Sandbox: No prompt_structure or valid prompt_id provided for testing.")
        return jsonify({"error": "No prompt instructions available to test."}), 400
    
    logger.debug(f"Sandbox System Prompt for AI (len {len(system_prompt_to_use)}): {system_prompt_to_use[:300]}...")
    try:
        ai_response, usage = generate_ai_response(system_prompt_to_use, user_test_prompt)
        if usage is not None:
            logger.info("Sandbox: AI response generated successfully.")
            return jsonify({"response": ai_response, "usage": usage}), 200
        else:
            logger.error(f"Sandbox: AI generation failed. AI response text: {ai_response}")
            return jsonify({"error": ai_response or "AI generation failed."}), 500
    except Exception as e:
         logger.exception(f"Sandbox: Unexpected error during AI generation: {e}")
         return jsonify({"error": "Server error occurred during AI generation."}), 500


# --- Quiz Generation Route (Teacher) ---
@app.route("/api/generate/quiz", methods=["POST"])
@jwt_required()
@require_role("teacher") # Ensure this decorator is working as expected
def generate_quiz_questions():
    logger.info("--- /api/generate/quiz [POST] ---")
    user_id = get_jwt_identity() # ID of the teacher making the request

    # Attempt to get JSON data at the very beginning
    if not request.is_json:
        logger.warning("/api/generate/quiz: Request is not JSON. Content-Type: %s", request.headers.get('Content-Type'))
        return jsonify({"error": "Request must be JSON and have Content-Type: application/json"}), 415

    try:
        data = request.get_json()
        if data is None:
            logger.warning("/api/generate/quiz: No JSON data received or failed to parse.")
            return jsonify({"error": "Invalid or empty JSON data."}), 400
    except Exception as e:
        logger.exception("/api/generate/quiz: Error parsing JSON data from request.")
        return jsonify({"error": "Malformed JSON data."}), 400

    logger.info(f"Quiz generation request from user_id: {user_id}. Payload type: {type(data)}")

    material_id = data.get("material_id")
    context_text_from_frontend = data.get("context_text", "")
    num_questions = data.get("num_questions", 5)
    # question_types = data.get("question_types", ["mcq"]) # Currently only actively supporting mcq for AI gen
    difficulty = data.get("difficulty", "medium")

    context_for_ai = ""
    if material_id:
        logger.info(f"Quiz Gen: Attempting to use Material ID: {material_id} for teacher {user_id}")
        # Ensure the material belongs to the teacher making the request
        material_obj = db.session.execute(
            db.select(Material).filter_by(id=material_id, user_id=user_id)
        ).scalar_one_or_none()

        if material_obj:
            if material_obj.extracted_text and material_obj.extracted_text.strip():
                context_for_ai = material_obj.extracted_text[:MAX_CHARS_FOR_QUIZ_CONTEXT]
                logger.info(f"Using extracted text (len {len(context_for_ai)}) from material '{material_obj.filename}' for quiz generation.")
                if len(material_obj.extracted_text) > MAX_CHARS_FOR_QUIZ_CONTEXT:
                    logger.warning(f"Material '{material_obj.filename}' text (original len {len(material_obj.extracted_text)}) was truncated for quiz generation context.")
            else:
                logger.warning(f"Material {material_id} (owned by {user_id}) has no extracted text.");
                return jsonify({"error": "Selected material has no text content to process."}), 400
        else:
            logger.warning(f"Material {material_id} not found or not owned by user {user_id}.")
            return jsonify({"error": "Material not found or you do not have permission to use it."}), 404 # Or 403 if preferred
    elif context_text_from_frontend:
        logger.info("Quiz Gen: Using custom text context provided by frontend.")
        context_for_ai = context_text_from_frontend[:MAX_CHARS_FOR_QUIZ_CONTEXT]
        if len(context_text_from_frontend) > MAX_CHARS_FOR_QUIZ_CONTEXT:
             logger.warning(f"Custom text context (original len {len(context_text_from_frontend)}) truncated for quiz generation.")
    else:
        logger.warning("Quiz Gen: Missing material_id or context_text for quiz generation.")
        return jsonify({"error": "Either select a material or provide custom text for context."}), 400

    if not context_for_ai.strip():
        logger.error("Quiz Gen: Context for AI is effectively empty after processing. Cannot generate questions.")
        return jsonify({"error": "Could not prepare a valid (non-empty) context for the AI based on your selection."}), 400
    
    try:
        num_questions = int(num_questions)
    except ValueError:
        logger.warning("Quiz Gen: Invalid num_questions format (not an integer).")
        return jsonify({"error": "Number of questions must be an integer."}), 400
    
    if not 1 <= num_questions <= 15: # Keep a sensible limit
        logger.warning(f"Quiz Gen: Invalid num_questions range ({num_questions}). Must be 1-15.")
        return jsonify({"error": "Number of questions must be between 1 and 15."}), 400

    generation_prompt = f"""Based on the provided context, generate {num_questions} quiz questions.
For each question:
- type: "mcq" (multiple choice question)
- text: The question itself.
- choices: An array of exactly 4 distinct strings representing answer options.
- correct_answer_index: An integer (0 to 3) indicating the index of the correct choice in the 'choices' array.
Ensure questions are directly derived from the context and the 'correct_answer_index' is accurate. QUESTIONS AND ANSWERS SHOULD BE IN GREEK. EACH QUESTION SHOULD BE DIFFERENT.
Output ONLY a valid JSON array of these question objects. Example of one object (DONT RETURN THE EXAMPLE):
{{"text": "What is the capital of France?", "type": "mcq", "choices": ["Berlin", "Madrid", "Paris", "Rome"], "correct_answer_index": 2}}

Context:
---
{context_for_ai}
---
JSON Output:
"""
    
    logger.info(f"Quiz Gen: Sending request to AI. NumQ: {num_questions}, Diff: {difficulty}, Context length: {len(context_for_ai)}")
    try:
        ai_response_text, usage = generate_ai_response(
            system_prompt="You are an AI assistant specialized in creating educational quiz questions in JSON format. Adhere strictly to the requested JSON structure and ensure the output is ONLY the JSON array.",
            user_prompt=generation_prompt
        )

        if usage is None or not ai_response_text: # AI call itself might have failed or returned empty
             logger.error(f"Quiz Gen: AI call failed or returned empty. Response: '{ai_response_text}'")
             return jsonify({"error": f"AI generation service failed or returned no content. Details: {ai_response_text}"}), 500

        logger.info(f"Quiz Gen: AI response received (length: {len(ai_response_text)}). Usage: {usage}")
        logger.debug(f"Quiz Gen: Raw AI response for parsing:\n{ai_response_text}\n--- End Raw AI Response ---")

        try:
            # More robust JSON extraction: find the outermost array or object
            json_match = None
            if '[' in ai_response_text and ']' in ai_response_text:
                json_start = ai_response_text.find('[')
                json_end = ai_response_text.rfind(']') + 1
                if json_start < json_end: # Basic sanity check
                    json_match = ai_response_text[json_start:json_end]
            
            if not json_match and '{' in ai_response_text and '}' in ai_response_text:
                # Fallback for cases where AI might return a single object instead of an array (though prompt asks for array)
                json_start = ai_response_text.find('{')
                json_end = ai_response_text.rfind('}') + 1
                if json_start < json_end:
                    single_obj_json = ai_response_text[json_start:json_end]
                    # Test if it's valid JSON object before wrapping
                    try:
                        json.loads(single_obj_json)
                        json_match = f"[{single_obj_json}]" # Wrap in array
                        logger.info("Quiz Gen: AI returned a single JSON object, wrapped in an array.")
                    except json.JSONDecodeError:
                        logger.warning(f"Quiz Gen: Found {{}}, but it's not valid JSON: {single_obj_json}")


            if not json_match:
                logger.error(f"Quiz Gen: Could not find valid JSON array/object markers in AI response: {ai_response_text}")
                raise ValueError("AI response did not contain recognizable JSON array or object.")

            generated_questions_from_ai = json.loads(json_match)

            if not isinstance(generated_questions_from_ai, list):
                 logger.error(f"Quiz Gen: AI response was not a list after parsing: {type(generated_questions_from_ai)}")
                 raise ValueError("AI did not return a JSON list as expected.")

            processed_questions = []
            for q_idx, ai_q in enumerate(generated_questions_from_ai):
                logger.debug(f"Processing AI question {q_idx+1}: {ai_q}")
                if not isinstance(ai_q, dict) or not all(k in ai_q for k in ['text', 'type', 'choices', 'correct_answer_index']):
                    logger.warning(f"AI returned incomplete question object: {ai_q}, skipping.")
                    continue
                if ai_q['type'] != 'mcq' or not isinstance(ai_q['choices'], list) or not all(isinstance(c, str) for c in ai_q['choices']):
                     logger.warning(f"AI returned invalid choices or type for question: '{ai_q.get('text')}', skipping.")
                     continue
                if not (2 <= len(ai_q['choices']) <= 5): # Allow 2 to 5 choices for more flexibility
                     logger.warning(f"AI returned an unexpected number of choices ({len(ai_q['choices'])}) for: '{ai_q.get('text')}', skipping.")
                     continue
                if not isinstance(ai_q['correct_answer_index'], int) or not (0 <= ai_q['correct_answer_index'] < len(ai_q['choices'])):
                     logger.warning(f"AI returned invalid correct_answer_index for: '{ai_q.get('text')}' (index: {ai_q['correct_answer_index']}, choices: {len(ai_q['choices'])}), skipping.")
                     continue

                fe_choices = []
                correct_choice_text_value = None
                for choice_idx, choice_text_from_ai in enumerate(ai_q['choices']):
                    is_correct_choice = (choice_idx == ai_q['correct_answer_index'])
                    fe_choices.append({"choice_text": str(choice_text_from_ai).strip(), "is_correct": is_correct_choice}) # Ensure text and strip
                    if is_correct_choice:
                        correct_choice_text_value = str(choice_text_from_ai).strip()
                
                if correct_choice_text_value is None and len(ai_q['choices']) > 0 : # Should be caught by index check, but for safety
                    logger.error(f"Logic error or bad AI output: Could not determine correct choice text for AI Q: {ai_q.get('text')}. Marking first as correct.")
                    # Fallback: if AI somehow messes up index but gives choices, mark first one.
                    fe_choices[0]["is_correct"] = True
                    correct_choice_text_value = fe_choices[0]["choice_text"]


                if correct_choice_text_value is not None : # Ensure we actually have a correct answer identified
                    processed_questions.append({
                        "question_text": str(ai_q.get('text','Untitled Question')).strip(),
                        "question_type": ai_q.get('type', 'mcq'),
                        "choices": fe_choices,
                        "correct_answer": correct_choice_text_value
                    })
                else:
                    logger.warning(f"Skipping question due to inability to identify correct answer: {ai_q.get('text')}")

            
            if not processed_questions:
                 logger.warning(f"Quiz Gen: No valid questions could be processed from AI response after validation.")
                 return jsonify({"error": "AI generated questions, but they were not in the expected format or were incomplete. Try a different context or parameters."}), 500 # Or 400

            logger.info(f"Quiz Gen: Successfully processed {len(processed_questions)} questions from AI response for teacher {user_id}.")
            return jsonify(processed_questions), 200

        except (json.JSONDecodeError, ValueError) as parse_error:
            logger.error(f"Quiz Gen: Failed to parse/process JSON from AI: {parse_error}", exc_info=True) # Log full traceback for value errors too
            logger.debug(f"Quiz Gen: Raw AI response that failed parsing:\n{ai_response_text}")
            return jsonify({"error": "AI returned data in an unexpected format. Please try generating again."}), 500
        except Exception as e:
            logger.exception(f"Quiz Gen: Unexpected error parsing/processing AI quiz response: {e}")
            return jsonify({"error": "An unexpected error occurred while processing the AI's response."}), 500

    except Exception as e:
         logger.exception(f"Quiz Gen: Error during OpenAI API call for teacher {user_id}: {e}")
         return jsonify({"error": "Failed to communicate with AI service for quiz generation."}), 500
         
# --- Quiz Management Routes (Teacher) ---
@app.route("/api/quizzes", methods=["POST"])
@jwt_required()
#@require_role("teacher")
def create_quiz():
    logger.info("--- /api/quizzes [POST] ---")
    user_id = get_jwt_identity(); user = db.session.get(User, user_id)
    if not user or not user.is_teacher: return jsonify({"error": "Access forbidden."}), 403
    if not request.is_json: logger.warning("Not JSON"); return jsonify({"error": "Request must be JSON"}), 415
    data = request.get_json(); logger.info(f"Create quiz request from {user_id}")
    if data is None: logger.warning("No JSON data"); return jsonify({"error": "Invalid JSON"}), 400
    title = data.get("title"); description = data.get("description", ""); questions_data = data.get("questions")
    if not title: logger.warning("Missing quiz title"); return jsonify({"error": "Quiz title required."}), 400
    if not questions_data or not isinstance(questions_data, list): logger.warning("Missing/invalid questions"); return jsonify({"error": "Questions list required."}), 400
    try:
        new_quiz = Quiz(teacher_id=user_id, title=title, description=description)
        db.session.add(new_quiz); db.session.flush()
        for idx, q_data in enumerate(questions_data):
            question_text = q_data.get("question_text"); question_type = q_data.get("question_type", "mcq")
            choices_data = q_data.get("choices", []); correct_answer_text = q_data.get("correct_answer")
            if not question_text: logger.warning(f"Skip Q {idx+1} no text"); continue
            new_question = Question(quiz_id=new_quiz.id, question_text=question_text, question_type=question_type, order_index=idx)
            db.session.add(new_question); db.session.flush()
            if question_type == 'mcq':
                if not choices_data or not isinstance(choices_data, list): logger.warning(f"Skip MCQ '{question_text}' no/bad choices"); continue
                correct_found = False
                for choice_data in choices_data:
                    choice_text = None; is_correct = False
                    if isinstance(choice_data, str): choice_text = choice_data; is_correct = (correct_answer_text and choice_text == correct_answer_text)
                    elif isinstance(choice_data, dict):
                        choice_text = choice_data.get("choice_text")
                        if 'is_correct' in choice_data: is_correct = bool(choice_data.get("is_correct"))
                        elif correct_answer_text and choice_text == correct_answer_text: is_correct = True
                    if not choice_text: logger.warning(f"Skip choice Q '{question_text}' no text"); continue
                    if is_correct: correct_found = True
                    new_choice = Choice(question_id=new_question.id, choice_text=choice_text, is_correct=is_correct)
                    db.session.add(new_choice)
                if not correct_found: raise ValueError(f"MCQ '{question_text[:50]}...' needs 1 correct answer.")
        db.session.commit(); logger.info(f"Quiz '{title}' created (ID: {new_quiz.id})")
        return jsonify(new_quiz.to_dict()), 201
    except ValueError as ve: db.session.rollback(); logger.error(f"Validation error quiz '{title}': {ve}"); return jsonify({"error": str(ve)}), 400
    except Exception as e: db.session.rollback(); logger.exception(f"Error creating quiz '{title}' {user_id}: {e}"); return jsonify({"error": "Server error create quiz."}), 500

@app.route("/api/quizzes", methods=["GET"])
@jwt_required()
#@require_role("teacher")
def list_teacher_quizzes():
    logger.info("--- /api/quizzes [GET] - Teacher List ---")
    user_id = get_jwt_identity(); user = db.session.get(User, user_id)
    if not user or not user.is_teacher: return jsonify({"error": "Access forbidden."}), 403
    logger.info(f"Listing quizzes for teacher {user_id}")
    try:
        quizzes = user.quizzes_created; sorted_quizzes = sorted(quizzes, key=lambda q: q.updated_at, reverse=True)
        return jsonify([q.to_dict(include_questions=False) for q in sorted_quizzes]), 200
    except Exception as e: logger.exception(f"Error list quizzes {user_id}: {e}"); return jsonify({"error": "Failed."}), 500

@app.route("/api/quizzes/<string:quiz_id>", methods=["GET"])
@jwt_required()
#@require_role("teacher")
def get_teacher_quiz_details(quiz_id):
    logger.info(f"--- /api/quizzes/{quiz_id} [GET] - Teacher Detail ---")
    user_id = get_jwt_identity(); user = db.session.get(User, user_id)
    if not user or not user.is_teacher: return jsonify({"error": "Access forbidden."}), 403
    try:
        quiz = db.session.execute(db.select(Quiz).filter_by(id=quiz_id, teacher_id=user_id)).scalar_one_or_none()
        if not quiz: logger.warning(f"Quiz not found/auth {quiz_id}"); return jsonify({"error": "Not found/auth"}), 404
        logger.info(f"Returning details for quiz '{quiz.title}'")
        quiz_dict = quiz.to_dict(include_questions=True)
        for q_dict in quiz_dict.get('questions', []):
            question_obj = db.session.get(Question, q_dict['id'])
            if question_obj and q_dict.get('question_type') == 'mcq':
                 q_dict['choices'] = [c.to_dict() | {'is_correct': c.is_correct} for c in question_obj.choices] # Include is_correct
        return jsonify(quiz_dict), 200
    except Exception as e: logger.exception(f"Error get quiz details {quiz_id}"); return jsonify({"error": "Failed."}), 500

@app.route("/api/quizzes/<string:quiz_id>", methods=["PUT"])
@jwt_required()
#@require_role("teacher")
def update_quiz(quiz_id):
    logger.info(f"--- /api/quizzes/{quiz_id} [PUT] ---")
    user_id = get_jwt_identity(); user = db.session.get(User, user_id)
    if not user or not user.is_teacher: return jsonify({"error": "Access forbidden."}), 403
    if not request.is_json: logger.warning("Not JSON"); return jsonify({"error": "Request must be JSON"}), 415
    data = request.get_json(); logger.info(f"Update quiz {quiz_id} data received")
    if data is None: logger.warning("No JSON data"); return jsonify({"error": "Invalid JSON"}), 400
    try:
        # Επίπεδο 1: Μέσα στο try
        stmt = db.select(Quiz).options(
            db.selectinload(Quiz.questions).selectinload(Question.choices)
        ).filter_by(id=quiz_id, teacher_id=user_id)
        quiz = db.session.execute(stmt).scalar_one_or_none()

        if not quiz:
            logger.warning(f"Quiz not found/auth {quiz_id}"); return jsonify({"error": "Not found/auth"}), 404

        if "title" in data: quiz.title = data["title"]
        if "description" in data: quiz.description = data["description"]
        if "is_published" in data: quiz.is_published = bool(data["is_published"])

        if "questions" in data and isinstance(data["questions"], list):
            logger.info(f"Replacing questions for quiz {quiz_id}")
            for old_q in list(quiz.questions): # Επίπεδο 2
                db.session.delete(old_q)
            db.session.flush()
            questions_data = data["questions"]
            for idx, q_data in enumerate(questions_data): # Επίπεδο 2
                # Επίπεδο 3
                question_text = q_data.get("question_text"); question_type = q_data.get("question_type", "mcq")
                choices_data = q_data.get("choices", []); correct_answer_text = q_data.get("correct_answer")
                if not question_text: continue
                new_question = Question(quiz_id=quiz.id, question_text=question_text, question_type=question_type, order_index=idx)
                db.session.add(new_question); db.session.flush()

                if question_type == 'mcq':
                    # Επίπεδο 4
                    correct_found = False
                    for choice_data in choices_data: # Επίπεδο 4
                        # Επίπεδο 5
                        choice_text = None; is_correct = False
                        if isinstance(choice_data, dict): # Επίπεδο 5
                            # Επίπεδο 6
                            choice_text = choice_data.get("choice_text")
                            is_correct = bool(choice_data.get("is_correct", False))
                        elif isinstance(choice_data, str): # Επίπεδο 5 (στο ίδιο επίπεδο με το if από πάνω)
                            # Επίπεδο 6
                            choice_text = choice_data

                        # Επίπεδο 5 (στο ίδιο επίπεδο με τα if/elif από πάνω)
                        if choice_text:
                            # Επίπεδο 6
                            if is_correct or (correct_answer_text and choice_text == correct_answer_text): # Επίπεδο 6
                                # Επίπεδο 7
                                is_correct = True
                                correct_found = True

                            new_choice = Choice(question_id=new_question.id, choice_text=choice_text, is_correct=is_correct)
                            db.session.add(new_choice)
                        # --- Εδώ βεβαιώσου ότι το else είναι στο Επίπεδο 5 ---
                        else:
                            # Επίπεδο 6
                            logger.warning(f"Skipping empty choice for Q: {question_text[:50]}")
                    # --- Βεβαιώσου ότι αυτό το if είναι στο Επίπεδο 4 ---
                    if not correct_found:
                         # Επίπεδο 5
                        raise ValueError(f"MCQ '{question_text[:50]}...' needs 1 correct answer.")

        # --- Βεβαιώσου ότι αυτό είναι στο Επίπεδο 1 ---
        db.session.commit(); logger.info(f"Quiz '{quiz.title}' ({quiz_id}) updated")
        return jsonify(quiz.to_dict(include_questions=False)), 200

    # --- Βεβαιώσου ότι αυτά είναι στο Επίπεδο 0 ---
    except ValueError as ve: db.session.rollback(); logger.error(f"Validation err update quiz {quiz_id}: {ve}"); return jsonify({"error": str(ve)}), 400
    except Exception as e: db.session.rollback(); logger.exception(f"Error updating quiz {quiz_id}: {e}"); return jsonify({"error": "Failed."}), 500
    
@app.route("/api/quizzes/<string:quiz_id>", methods=["DELETE"])
@jwt_required()
#@require_role("teacher")
def delete_quiz(quiz_id):
    logger.info(f"--- /api/quizzes/{quiz_id} [DELETE] ---")
    user_id = get_jwt_identity(); user = db.session.get(User, user_id)
    if not user or not user.is_teacher: return jsonify({"error": "Access forbidden."}), 403
    try:
        quiz = db.session.execute(db.select(Quiz).filter_by(id=quiz_id, teacher_id=user_id)).scalar_one_or_none()
        if not quiz: logger.warning(f"Quiz not found/auth {quiz_id}"); return jsonify({"error": "Not found/auth"}), 404
        quiz_title = quiz.title
        db.session.delete(quiz); db.session.commit()
        logger.info(f"Quiz '{quiz_title}' ({quiz_id}) deleted")
        return jsonify({"message": "Quiz deleted"}), 200
    except Exception as e: db.session.rollback(); logger.exception(f"Error deleting quiz {quiz_id}: {e}"); return jsonify({"error": "Failed."}), 500

# --- Student Quiz Routes ---
@app.route("/api/student/quizzes", methods=["GET"])
@jwt_required()
def list_available_student_quizzes():
    logger.info("--- /api/student/quizzes [GET] ---")
    user_id = get_jwt_identity(); student = db.session.get(User, user_id)
    if not student: return jsonify({"error": "User not found."}), 404
    try:
        logger.info(f"User {user_id} requesting available quizzes")
        published_quizzes = db.session.execute(db.select(Quiz).filter_by(is_published=True).order_by(Quiz.title)).scalars().all()
        result_list = [q.to_dict(include_questions=False, student_id=user_id) for q in published_quizzes] # Add attempt status
        logger.info(f"Found {len(published_quizzes)} published quizzes")
        return jsonify(result_list), 200
    except Exception as e: logger.exception(f"Error list student quizzes {user_id}: {e}"); return jsonify({"error": "Failed."}), 500
@app.route("/api/student/quizzes/<string:quiz_id>/take", methods=["GET"])
@jwt_required()
def get_quiz_for_student(quiz_id):
    logger.info(f"--- /api/student/quizzes/{quiz_id}/take [GET] ---")
    user_id = get_jwt_identity() # Get the ID of the logged-in student
    try:
        # Construct the SELECT statement
        stmt = db.select(Quiz).options(
            db.selectinload(Quiz.questions).selectinload(Question.choices) # Eager load questions and their choices
        ).filter_by(id=quiz_id, is_published=True) # Apply filter for quiz ID and ensure it's published

        # Execute the statement and get a single result (or None if not found)
        quiz = db.session.execute(stmt).scalar_one_or_none()

        if not quiz:
            logger.warning(f"Student {user_id} requested non-existent or unpublished quiz ID: {quiz_id}")
            return jsonify({"error": "Quiz not found or not currently available."}), 404

        logger.info(f"Student {user_id} starting quiz '{quiz.title}' (ID: {quiz_id})")

        # Prepare the quiz data to send to the frontend
        quiz_dict = quiz.to_dict(include_questions=True) # Get questions

        # Remove 'is_correct' flag from choices before sending to student
        if quiz_dict.get('questions'):
            for q_data in quiz_dict['questions']:
                if q_data.get('question_type') == 'mcq' and 'choices' in q_data:
                    # Create new list of choices without is_correct
                    q_data['choices'] = [
                        {'id': choice['id'], 'choice_text': choice['choice_text']}
                        for choice in q_data['choices']
                    ]
        
        return jsonify(quiz_dict), 200

    except Exception as e:
        logger.exception(f"Error fetching quiz {quiz_id} for student {user_id} to take: {e}")
        return jsonify({"error": "Failed to load the quiz due to a server error."}), 500

@app.route("/api/student/quizzes/<string:quiz_id>/submit", methods=["POST"])
@jwt_required()
def submit_quiz_answers(quiz_id):
    logger.info(f"--- /api/student/quizzes/{quiz_id}/submit [POST] ---")
    user_id = get_jwt_identity()
    student = db.session.get(User, user_id)

    # Debug log for user role
    if student:
        logger.info(f"Submit attempt by user: {student.email}, Role: {student.role}")
    else:
        logger.warning(f"Submit attempt: User with ID {user_id} not found in DB!")
        return jsonify({"error": "Authenticated user not found in database."}), 401 # Or 500

    if not student or not student.is_student:
        logger.warning(f"Submit attempt DENIED for user {user_id}. User is not a student or not found.")
        return jsonify({"error": "Invalid user or insufficient permissions."}), 403

    if not request.is_json:
        logger.warning("Request is not JSON for quiz submit")
        return jsonify({"error": "Request must be JSON"}), 415

    data = request.get_json()
    logger.info(f"Quiz submit from {user_id} for quiz {quiz_id}")
    if data is None:
        logger.warning("No JSON data in quiz submit")
        return jsonify({"error": "Invalid JSON data received."}), 400

    answers_payload = data.get("answers") # Expecting dict like: { "question_id_str": "answer_text_or_choice_id_str", ... }
    if not answers_payload or not isinstance(answers_payload, dict):
        logger.warning("Missing or invalid answers payload format")
        return jsonify({"error": "Invalid answers format."}), 400

    try:
        # Correct SQLAlchemy 2.0+ way to select, filter, and eager load
        stmt = db.select(Quiz).options(
            db.selectinload(Quiz.questions).selectinload(Question.choices) # Eager load questions and their choices
        ).filter_by(id=quiz_id, is_published=True) # Apply filter for quiz ID and ensure it's published

        quiz = db.session.execute(stmt).scalar_one_or_none() # Execute and get single result or None

        if not quiz:
            logger.warning(f"Quiz {quiz_id} not found or not published for submission by student {user_id}")
            return jsonify({"error": "Quiz not found or currently unavailable for submission."}), 404

        # Check if student already submitted this quiz
        existing_attempt_stmt = db.select(StudentQuizAttempt).filter(
            StudentQuizAttempt.student_id == user_id,
            StudentQuizAttempt.quiz_id == quiz_id,
            StudentQuizAttempt.submitted_at != None
        )
        existing_attempt = db.session.execute(existing_attempt_stmt).scalar_one_or_none()

        if existing_attempt:
            logger.warning(f"Student {user_id} attempting to resubmit quiz {quiz_id} (Attempt ID: {existing_attempt.id})")
            return jsonify({"error": "You have already submitted this quiz."}), 409 # Conflict

        # Create a new attempt record
        new_attempt = StudentQuizAttempt(student_id=user_id, quiz_id=quiz_id)
        db.session.add(new_attempt)
        db.session.flush() # Get new_attempt.id before adding answers

        logger.info(f"Created new quiz attempt {new_attempt.id} for student {user_id}, quiz {quiz_id}")

        all_questions_map = {q.id: q for q in quiz.questions} # Map questions by ID for quick lookup
        ai_feedback_tasks = [] # Collect data needed for AI feedback generation

        # Process submitted answers
        for q_id_str, provided_answer_text in answers_payload.items():
            if q_id_str not in all_questions_map:
                logger.warning(f"Received answer for unknown question ID '{q_id_str}' in quiz {quiz_id} attempt {new_attempt.id}")
                continue # Skip this answer

            question_obj = all_questions_map[q_id_str]
            is_correct_answer = False # Default to false

            # --- Simple Grading (MCQ only for now) ---
            if question_obj.question_type == 'mcq':
                correct_choice_text = question_obj.get_correct_answer_value() # This should be the text of the correct choice
                # provided_answer_text from frontend is the *text* of the chosen choice for MCQs
                is_correct_answer = (correct_choice_text is not None and provided_answer_text == correct_choice_text)
                logger.debug(f"Grading QID:{q_id_str} - Provided: '{provided_answer_text}', Correct Choice Text: '{correct_choice_text}', Result: {is_correct_answer}")

                # If incorrect, prepare data for AI feedback
                if not is_correct_answer:
                    ai_feedback_tasks.append({
                        "question_id": q_id_str,
                        "question_text": question_obj.question_text,
                        "student_answer": provided_answer_text or "N/A",
                        "correct_answer": correct_choice_text or "N/A"
                    })
            else:
                 logger.warning(f"Grading not implemented for question type '{question_obj.question_type}' (QID: {q_id_str})")
                 is_correct_answer = None # Mark as ungraded for now, or handle as incorrect

            # Store the student's answer
            student_answer_record = StudentAnswer(
                attempt_id=new_attempt.id,
                question_id=q_id_str,
                answer_text=provided_answer_text,
                is_correct=is_correct_answer
            )
            db.session.add(student_answer_record)

        # --- Generate AI Feedback (if any incorrect answers were recorded) ---
        if ai_feedback_tasks:
            logger.info(f"Attempt {new_attempt.id}: Generating AI feedback for {len(ai_feedback_tasks)} incorrect answers...")
            ai_feedback_results = {} # Store feedback indexed by question_id

            for task_data in ai_feedback_tasks:
                try:
                    feedback_gen_prompt = f"""
                    A student answered a quiz question incorrectly.
                    Question: {task_data['question_text']}
                    Student's Answer: {task_data['student_answer']}
                    Correct Answer: {task_data['correct_answer']}

                    Provide short (1-2 sentences), constructive feedback explaining why the student's answer is incorrect
                    and gently guiding them towards the correct concept without giving away the answer directly.
                    Maintain an encouraging and supportive tone suitable for a student.
                    Focus on the conceptual mistake if possible.

                    Feedback:
                    """
                    feedback_response_text, fb_usage_info = generate_ai_response(
                         system_prompt="You are a helpful AI teaching assistant providing quiz feedback.",
                         user_prompt=feedback_gen_prompt
                    )
                    if fb_usage_info:
                        ai_feedback_results[task_data["question_id"]] = feedback_response_text.strip()
                        logger.debug(f"Generated feedback for QID:{task_data['question_id']}")
                    else:
                         logger.error(f"AI call failed for feedback generation on QID:{task_data['question_id']}: {feedback_response_text}")
                         ai_feedback_results[task_data["question_id"]] = "Sorry, an error occurred while generating feedback."
                except Exception as ai_fb_ex:
                     logger.exception(f"Error during AI feedback generation for QID:{task_data['question_id']}: {ai_fb_ex}")
                     ai_feedback_results[task_data["question_id"]] = "An unexpected error occurred generating feedback."

            # Update StudentAnswer records with generated feedback
            db.session.flush() # Ensure answers exist before querying them for update
            for answer_record in new_attempt.answers:
                if answer_record.question_id in ai_feedback_results:
                    answer_record.ai_feedback = ai_feedback_results[answer_record.question_id]

        # --- Finalize Attempt ---
        new_attempt.submitted_at = datetime.now(timezone.utc)
        new_attempt.calculate_score() # Calculate final score based on graded answers
        logger.info(f"Attempt {new_attempt.id} finalized. Score: {new_attempt.score}% ({new_attempt.correct_answers}/{new_attempt.total_questions})")

        db.session.commit()

        # Return the full attempt details including score and feedback
        return jsonify(new_attempt.to_dict(include_answers=True)), 200

    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error submitting/grading quiz {quiz_id} for student {user_id}: {e}")
        return jsonify({"error": "Failed to submit quiz answers due to a server error."}), 500
        
@app.route("/api/student/attempts/<string:attempt_id>", methods=["GET"])
@jwt_required()
def get_student_attempt_details(attempt_id):
    logger.info(f"--- /api/student/attempts/{attempt_id} [GET] ---")
    user_id = get_jwt_identity()
    try:
        attempt = db.session.execute(db.select(StudentQuizAttempt).options(db.selectinload(StudentQuizAttempt.answers).selectinload(StudentAnswer.question)).filter_by(id=attempt_id, student_id=user_id)).scalar_one_or_none() # Eager load answers/questions
        if not attempt: logger.warning(f"Attempt not found/auth {attempt_id}"); return jsonify({"error": "Not found/auth."}), 404
        if not attempt.submitted_at: logger.warning(f"Unsubmitted attempt {attempt_id}"); return jsonify({"error": "Not submitted yet."}), 400
        logger.info(f"Returning details for attempt {attempt_id}")
        return jsonify(attempt.to_dict(include_answers=True)), 200
    except Exception as e: logger.exception(f"Error fetching attempt {attempt_id}: {e}"); return jsonify({"error": "Failed."}), 500

# --- Teacher Analytics Route ---
@app.route("/api/teachers/quizzes/<string:quiz_id>/attempts", methods=["GET"])
@jwt_required()
#@require_role("teacher")
def get_quiz_attempts_for_teacher(quiz_id):
    logger.info(f"--- /api/teachers/quizzes/{quiz_id}/attempts [GET] ---")
    user_id = get_jwt_identity(); teacher = db.session.get(User, user_id)
    if not teacher or not teacher.is_teacher: return jsonify({"error": "Access forbidden."}), 403
    try:
        quiz = db.session.execute(db.select(Quiz).filter_by(id=quiz_id, teacher_id=user_id)).scalar_one_or_none()
        if not quiz: logger.warning(f"Quiz not found/auth {quiz_id} for teacher {user_id}"); return jsonify({"error": "Not found/auth"}), 404
        logger.info(f"Fetching attempts for quiz '{quiz.title}' ({quiz_id})")
        attempts = db.session.execute(db.select(StudentQuizAttempt).join(User).filter(StudentQuizAttempt.quiz_id == quiz_id, StudentQuizAttempt.submitted_at != None).order_by(User.email)).scalars().all()
        logger.info(f"Found {len(attempts)} submitted attempts")
        results = []
        for attempt in attempts:
             attempt_dict = attempt.to_dict(include_answers=False); attempt_dict['student_email'] = attempt.student.email if attempt.student else 'N/A'
             results.append(attempt_dict)
        return jsonify(results), 200
    except Exception as e: logger.exception(f"Error fetching attempts quiz {quiz_id} for teacher {user_id}: {e}"); return jsonify({"error": "Failed."}), 500

# --- Student Prompt Routes ---
# Added this route back - CHECK IF IT WAS ACCIDENTALLY DELETED BEFORE
@app.route("/api/student/prompts", methods=["GET"])
@jwt_required() # Any logged-in user
def list_available_student_prompts():
    logger.info("--- /api/student/prompts [GET] ---") # Renamed log message slightly
    user_id = get_jwt_identity()
    try:
        logger.info(f"User {user_id} requesting public prompts")
        public_prompts = db.session.execute(
            db.select(Prompt).filter_by(is_public=True).order_by(Prompt.name)
        ).scalars().all()
        logger.info(f"Found {len(public_prompts)} public prompts")
        return jsonify([p.to_dict(include_structure=False) for p in public_prompts]), 200
    except Exception as e:
        logger.exception(f"Error listing public prompts for user {user_id}: {e}")
        return jsonify({"error": "Failed to retrieve available assistants."}), 500

# --- /api/student/ask (POST) ---
@app.route("/api/student/ask", methods=["POST"])
@jwt_required() # Require login
def ask_assistant():
    logger.info("--- /api/student/ask [POST] ---")
    # ... (rest of ask_assistant implementation remains the same) ...
    user_id = get_jwt_identity(); student = db.session.get(User, user_id)
    if not student: logger.error(f"User not found {user_id}"); return jsonify({"error": "Auth error"}), 401
    if not request.is_json: logger.warning("Not JSON"); return jsonify({"error": "Request must be JSON"}), 415
    data = request.get_json(); logger.info(f"Student ask from {user_id}")
    if data is None: logger.warning("No JSON data"); return jsonify({"error": "Invalid JSON"}), 400
    prompt_id = data.get("prompt_id"); student_question = data.get("question")
    if not prompt_id or not student_question: logger.warning("Missing prompt/question"); return jsonify({"error": "Prompt/question required"}), 400
    try:
        logger.info(f"Fetching public prompt {prompt_id}")
        prompt = db.session.execute(db.select(Prompt).filter_by(id=prompt_id, is_public=True)).scalar_one_or_none()
        if not prompt: logger.warning(f"Prompt not found/private {prompt_id}"); return jsonify({"error": "Assistant not found."}), 404
        logger.info(f"Constructing prompt '{prompt.name}'")
        system_prompt, user_question = construct_final_prompt(prompt.structure, student_question)
        if system_prompt.startswith("Error:"): logger.error(f"Prompt construct failed {prompt_id}: {system_prompt}"); return jsonify({"error": "Config error."}), 500
        logger.info(f"Sending to OpenAI for student {user_id}, prompt {prompt_id}")
        ai_response, usage = generate_ai_response(system_prompt, user_question)
        if usage is not None: logger.info(f"OpenAI OK. Usage: {usage}"); return jsonify({"response": ai_response, "usage": usage}), 200
        else: logger.error(f"OpenAI failed: {ai_response}"); return jsonify({"error": ai_response or "Failed."}), 500
    except Exception as e:
         logger.exception(f"Error during student ask {prompt_id}, user {user_id}: {e}"); return jsonify({"error": "Server error."}), 500


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    build_folder = os.path.join(os.path.dirname(__file__), 'build')
    if path != "" and os.path.exists(os.path.join(build_folder, path)):
        return send_from_directory(build_folder, path)
    else:
        # Επιστρέφει το index.html για οποιοδήποτε άλλο URL,
        # επιτρέποντας στο React Router να αναλάβει την πλοήγηση.
        return send_from_directory(build_folder, 'index.html')


# --- Main Execution ---
if __name__ == "__main__":
    logger.info("Entering main execution block (__name__ == '__main__')")
    with app.app_context():
         try:
             db.session.execute(db.text('SELECT 1')); logger.info("Database connection check successful.")
         except Exception as db_err: logger.exception("CRITICAL ERROR - Database connection failed on startup")
    logger.info("Starting Flask development server...")
    is_debug_mode = os.getenv("FLASK_ENV", "development").lower() == 'development'
    logger.info(f"Running with debug mode: {is_debug_mode}")
    app_port = 5001 # Using port 5001
    logger.info(f"Attempting to run on host 0.0.0.0, port {app_port}")
    try: app.run(host="0.0.0.0", port=app_port, debug=is_debug_mode)
    except OSError as e: logger.critical(f"Could not start server on port {app_port}: {e}", exc_info=True)
    except Exception as e: logger.critical(f"Unexpected error starting server: {e}", exc_info=True)
    logger.info("Flask server has stopped.")
else: logger.info("App loaded as a module.")
