import os
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import uuid
import json  # Required for JSON operations if needed, though SQLAlchemy handles JSON type

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(10), nullable=False, default='student')  # 'teacher' or 'student'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    # Teacher relationships
    materials = db.relationship('Material', backref='owner_user', lazy=True, foreign_keys='Material.user_id',
                                primaryjoin="and_(User.id==Material.user_id, User.role=='teacher')",
                                cascade="all, delete-orphan")
    prompts = db.relationship('Prompt', backref='owner_user', lazy=True, foreign_keys='Prompt.user_id',
                              primaryjoin="and_(User.id==Prompt.user_id, User.role=='teacher')",
                              cascade="all, delete-orphan")
    quizzes_created = db.relationship('Quiz', backref='creator', lazy=True, foreign_keys='Quiz.teacher_id',
                                   primaryjoin="and_(User.id==Quiz.teacher_id, User.role=='teacher')",
                                   cascade="all, delete-orphan")

    # Student relationships
    quiz_attempts = db.relationship('StudentQuizAttempt', backref='student', lazy='dynamic',  # Use dynamic for potentially large lists
                                     foreign_keys='StudentQuizAttempt.student_id',
                                     primaryjoin="and_(User.id==StudentQuizAttempt.student_id, User.role=='student')",
                                     cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def is_teacher(self): return self.role == 'teacher'
    @property
    def is_student(self): return self.role == 'student'

    def to_dict(self):
        return {"id": self.id, "email": self.email, "role": self.role, "created_at": self.created_at.isoformat()}

    def __repr__(self):
        return f'<User {self.email} (Role: {self.role})>'

class Material(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)  # Teacher ID
    filename = db.Column(db.String(255), nullable=False)
    filepath = db.Column(db.String(512), nullable=False)
    extracted_text = db.Column(db.Text, nullable=True)
    summary = db.Column(db.Text, nullable=True)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {"id": self.id, "name": self.filename, "summary": self.summary or "N/A", "uploaded_at": self.uploaded_at.isoformat()}

    def __repr__(self):
        return f'<Material {self.filename} for User {self.user_id}>'

class Prompt(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.String(500), nullable=True)
    structure = db.Column(db.JSON, nullable=False) # Editable structure with placeholders
    system_prompt = db.Column(db.Text, nullable=True) # Resolved system prompt for execution <-- ΝΕΟ ΠΕΔΙΟ
    is_public = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, include_structure=False, include_system_prompt=False): # Added include_system_prompt
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description or "A helpful AI assistant.",
            "is_public": self.is_public,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "owner_id": self.user_id
        }
        if include_structure: data["structure"] = self.structure
        if include_system_prompt: data["system_prompt"] = self.system_prompt # <-- ΝΕΟ
        return data

    def __repr__(self):
        visibility = "Public" if self.is_public else "Private"
        return f'<Prompt {self.name} (Visibility: {visibility}) for User {self.user_id}>'


# --- New Models for Quizzes ---

class Quiz(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    teacher_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False) # Link to the creating teacher
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    is_published = db.Column(db.Boolean, default=False, nullable=False) # If students can take it
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to Questions
    questions = db.relationship('Question', backref='quiz', lazy=True, cascade="all, delete-orphan", order_by='Question.order_index')
    # Relationship to student attempts
    attempts = db.relationship('StudentQuizAttempt', backref='quiz', lazy='dynamic', cascade="all, delete-orphan")

    def to_dict(self, include_questions=False, student_id=None):
        data = {
            "id": self.id,
            "title": self.title,
            "description": self.description or "",
            "is_published": self.is_published,
            "question_count": len(self.questions), # Calculate question count
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "teacher_id": self.teacher_id,
        }
        if include_questions:
            data['questions'] = [q.to_dict(include_choices=True) for q in self.questions] # Include choices when getting questions

        # Optionally include student attempt info if student_id is provided
        if student_id:
             attempt = self.attempts.filter_by(student_id=student_id).order_by(StudentQuizAttempt.submitted_at.desc()).first()
             if attempt:
                 data['student_attempt'] = attempt.to_dict(include_answers=False) # Don't need answers again here

        return data

    def __repr__(self):
        status = "Published" if self.is_published else "Draft"
        return f'<Quiz {self.title} (Status: {status}) by User {self.teacher_id}>'

class Question(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    quiz_id = db.Column(db.String(36), db.ForeignKey('quiz.id'), nullable=False)
    question_text = db.Column(db.Text, nullable=False)
    question_type = db.Column(db.String(50), nullable=False, default='mcq') # E.g., 'mcq', 'open_ended'
    order_index = db.Column(db.Integer, nullable=False, default=0) # To maintain question order
    # Optional: Store the prompt used to generate this question by AI
    ai_generation_prompt = db.Column(db.Text, nullable=True)

    # Relationship to Choices (for MCQ)
    choices = db.relationship('Choice', backref='question', lazy=True, cascade="all, delete-orphan", order_by='Choice.id')
    # Relationship to student answers for this question
    student_answers = db.relationship('StudentAnswer', backref='question', lazy='dynamic')

    def to_dict(self, include_choices=False):
        data = {
            "id": self.id,
            "quiz_id": self.quiz_id,
            "question_text": self.question_text,
            "question_type": self.question_type,
            "order_index": self.order_index,
            # "ai_generation_prompt": self.ai_generation_prompt # Maybe only for internal use
        }
        if include_choices and self.question_type == 'mcq':
            data['choices'] = [c.to_dict() for c in self.choices]
        # Don't include correct answer info when sending to student initially
        return data

    def get_correct_answer_value(self):
        """Helper to get the value of the correct choice(s) for grading."""
        if self.question_type == 'mcq':
            correct_choices = [c.choice_text for c in self.choices if c.is_correct]
            # Assuming single correct answer for now for MCQs
            return correct_choices[0] if correct_choices else None
        # Add logic for other question types later (e.g., open_ended might need AI grading)
        return None

    def __repr__(self):
        return f'<Question {self.id} (Quiz: {self.quiz_id}) Type: {self.question_type}>'

class Choice(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    question_id = db.Column(db.String(36), db.ForeignKey('question.id'), nullable=False)
    choice_text = db.Column(db.Text, nullable=False)
    is_correct = db.Column(db.Boolean, default=False, nullable=False)

    def to_dict(self):
        # IMPORTANT: DO NOT send is_correct flag to student when taking the quiz!
        # This dict might need adjustment depending on context (sending to teacher vs student).
        # For now, let's assume this basic version is okay, and filter later.
        return {
            "id": self.id,
            "question_id": self.question_id,
            "choice_text": self.choice_text,
            # "is_correct": self.is_correct # Exclude this when sending to student taker UI
        }

    def __repr__(self):
        correct_marker = "*" if self.is_correct else ""
        return f'<Choice {self.id} for Q {self.question_id} Text: {self.choice_text[:30]}{correct_marker}>'


class StudentQuizAttempt(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    quiz_id = db.Column(db.String(36), db.ForeignKey('quiz.id'), nullable=False)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    submitted_at = db.Column(db.DateTime, nullable=True) # Null until submitted
    score = db.Column(db.Float, nullable=True) # Overall score (e.g., percentage or points)
    total_questions = db.Column(db.Integer, nullable=True) # Store total questions at time of attempt
    correct_answers = db.Column(db.Integer, nullable=True) # Store count of correct answers

    # Relationship to individual answers
    answers = db.relationship('StudentAnswer', backref='attempt', lazy=True, cascade="all, delete-orphan")

    def calculate_score(self):
        """Calculates score based on answers. Call after all answers are graded."""
        if not self.answers:
            self.score = 0.0
            self.correct_answers = 0
            # Get total questions from the quiz itself if needed
            quiz_obj = db.session.get(Quiz, self.quiz_id)
            self.total_questions = len(quiz_obj.questions) if quiz_obj else 0
            return

        total_q = len(self.answers)
        correct_q = sum(1 for answer in self.answers if answer.is_correct)
        self.correct_answers = correct_q
        self.total_questions = total_q
        self.score = (float(correct_q) / total_q) * 100 if total_q > 0 else 0.0

    def to_dict(self, include_answers=False):
        data = {
            "id": self.id,
            "student_id": self.student_id,
            "quiz_id": self.quiz_id,
            "quiz_title": self.quiz.title if self.quiz else "N/A", # Include quiz title
            "started_at": self.started_at.isoformat(),
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "score": self.score,
            "total_questions": self.total_questions,
            "correct_answers": self.correct_answers
        }
        if include_answers:
            data['answers'] = [a.to_dict() for a in self.answers]
        return data

    def __repr__(self):
        return f'<Attempt {self.id} by S:{self.student_id} on Q:{self.quiz_id} Score:{self.score}>'


class StudentAnswer(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    attempt_id = db.Column(db.String(36), db.ForeignKey('student_quiz_attempt.id'), nullable=False)
    question_id = db.Column(db.String(36), db.ForeignKey('question.id'), nullable=False)
    # Store the answer provided by the student. For MCQ, this might be the Choice ID or text.
    answer_text = db.Column(db.Text, nullable=True)
    is_correct = db.Column(db.Boolean, nullable=True) # Null until graded
    # Store AI-generated feedback if the answer was incorrect
    ai_feedback = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "attempt_id": self.attempt_id,
            "question_id": self.question_id,
            "answer_text": self.answer_text,
            "is_correct": self.is_correct,
            "ai_feedback": self.ai_feedback,
            # Optionally include question text for context
            "question_text": self.question.question_text if self.question else "N/A",
        }

    def __repr__(self):
        status = "Correct" if self.is_correct else ("Incorrect" if self.is_correct is False else "Ungraded")
        return f'<Answer {self.id} for Att:{self.attempt_id} Q:{self.question_id} Status:{status}>'


# --- Database Initialization Function ---
def init_db(app):
    """Initializes the database."""
    db_uri = os.getenv('DATABASE_URL', 'sqlite:///./app.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = db_uri
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    # Optional: Add pool recycling or other engine options if needed
    # app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {'pool_recycle': 280}
    db.init_app(app)
    # logger.info(f"Database URI configured: {db_uri}") # Log the URI being used

    # Important: Don't call db.create_all() here if using Flask-Migrate
    # with app.app_context():
    #     db.create_all() # Let Flask-Migrate handle table creation/updates