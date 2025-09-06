import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    DndContext, DragOverlay, closestCenter, PointerSensor, KeyboardSensor,
    useSensor, useSensors, MeasuringStrategy
} from '@dnd-kit/core';
import {
    SortableContext, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates
} from '@dnd-kit/sortable';
import { v4 as uuidv4 } from 'uuid';

import BlockPalette from './BlockPalette';
import PromptBuilder from './PromptBuilder/PromptBuilder';
import SortableBlock from './PromptBuilder/SortableBlock';
import Sandbox from './Sandbox';
import Modal from '../common/Modal';
import MaterialListForModal from './MaterialListForModal';
import PromptListForModal from './PromptListForModal';

import { getMaterials, getTeacherPrompts, savePrompt, updatePrompt, getPromptDetails } from '../../services/api';

import { FaSave, FaEdit, FaFileUpload, FaHistory, FaQuestion, FaSyncAlt, FaSpinner } from 'react-icons/fa';

import '../../styles/PromptWorkshop.css';

// Block Types Definition (καμία αλλαγή)
export const BlockTypes = {
    PALETTE_ITEM: 'palette-item',
    CANVAS_BLOCK: 'canvas-block',
    MATERIAL_SUMMARY: 'material-summary',
    CUSTOM_TEXT: 'custom-text',
};

// Μεταφρασμένα και βελτιωμένα μπλοκ οδηγιών (unchanged)
const initialPreMadeBlocks = {
    '🎯 Βασικός Ρόλος & Προσωπικότητα': [
        { id: 'core-task-1', type: BlockTypes.PALETTE_ITEM, title: 'Κύριος Ρόλος', content: 'Λειτούργησε ως ένας εξυπηρετικός ψηφιακός βοηθός διδασκαλίας για μαθητές [Τάξη/Επίπεδο], με ειδίκευση στο μάθημα [Μάθημα/Θέμα].' },
        { id: 'persona-expert-1', type: BlockTypes.PALETTE_ITEM, title: 'Προσωπικότητα Ειδικού', content: 'Υιοθέτησε την προσωπικότητα ενός ειδικού με γνώσεις και μεταδοτικότητα στο αντικείμενο [Μάθημα/Θέμα]. Εξήγησε τις έννοιες με σαφήνεια.' },
        { id: 'persona-mentor-1', type: BlockTypes.PALETTE_ITEM, title: 'Προσωπικότητα Μέντορα', content: 'Υιοθέτησε την προσωπικότητα ενός υποστηρικτικού μέντορα, καθοδηγώντας τους μαθητές στο μαθησιακό τους ταξίδι.' },
    ],
    '🗣️ Ύφος & Τόνος': [
        { id: 'tone-friendly-1', type: BlockTypes.PALETTE_ITEM, title: 'Φιλικό & Ενθαρρυντικό Ύφος', content: 'Διατήρησε έναν φιλικό, υπομονετικό και ενθαρρυντικό τόνο σε όλη τη συζήτηση. Χρησιμοποίησε θετική ενίσχυση.' },
        { id: 'tone-formal-1', type: BlockTypes.PALETTE_ITEM, title: 'Επίσημο & Ακαδημαϊκό Ύφος', content: 'Υιοθέτησε ένα επίσημο, αντικειμενικό και ακαδημαϊκό ύφος, κατάλληλο για μελέτη.' },
        { id: 'style-concise-1', type: BlockTypes.PALETTE_ITEM, title: 'Συνοπτικές Απαντήσεις', content: 'Κράτα τις εξηγήσεις σου σαφείς, περιεκτικές και όσο το δυνατόν πιο σύντομες, χωρίς να χάνεται το νόημα.' },
        { id: 'style-detailed-1', type: BlockTypes.PALETTE_ITEM, title: 'Αναλυτικές Εξηγήσεις', content: 'Παρείχε αναλυτικές εξηγήσεις, προσφέροντας υπόβαθρο, παραδείγματα και αναλογίες όπου είναι χρήσιμο.' },
    ],
    '📚 Πλαίσιο & Γνώση': [
        { id: 'ctx-material-1', type: BlockTypes.PALETTE_ITEM, title: 'Χρήση ΜΟΝΟ του Υλικού', content: 'Βάσισε αυστηρά τις απαντήσεις και τις εξηγήσεις σου στο διδακτικό υλικό που παρέχεται. Εάν μια πληροφορία δεν υπάρχει, δήλωσέ το ξεκάθαρα και μην επινοείς απαντήσεις.' },
        { id: 'ctx-refer-material-1', type: BlockTypes.PALETTE_ITEM, title: 'Αναφορά σε Συγκεκριμένο Υλικό', content: 'Όταν απαντάς, να αναφέρεσαι ρητά σε συγκεκριμένες ενότητες ή ιδέες από το [Όνομα Μπλοκ Υλικού], εάν είναι σχετικό.' },
    ],
    '💡 Διδακτικές Στρατηγικές': [
        { id: 'strat-socratic-1', type: BlockTypes.PALETTE_ITEM, title: 'Σωκρατική Μέθοδος', content: 'Αντί να δίνεις άμεσες απαντήσεις, καθοδήγησε τους μαθητές κάνοντας μια σειρά από διερευνητικές ερωτήσεις για να τους βοηθήσεις να φτάσουν στη λύση μόνοι τους.' },
        { id: 'strat-stepbystep-1', type: BlockTypes.PALETTE_ITEM, title: 'Ανάλυση Βήμα-Βήμα', content: 'Για σύνθετα προβλήματα ή διαδικασίες, ανάλυσέ τα σε μικρότερα, λογικά και εύκολα βήματα. Εξήγησε κάθε βήμα με σαφήνεια.' },
        { id: 'strat-analogy-1', type: BlockTypes.PALETTE_ITEM, title: 'Χρήση Αναλογιών', content: 'Χρησιμοποίησε σχετικές αναλογίες και παραδείγματα από την καθημερινή ζωή για να κάνεις τις αφηρημένες έννοιες πιο κατανοητές.' },
    ],
    '✅ Παραδείγματα & Υποστήριξη': [
        { id: 'ex-positive-1', type: BlockTypes.PALETTE_ITEM, title: 'Παράδειγμα Διαλόγου', content: 'Παράδειγμα Ερώτησης Μαθητή: [Απλή Ερώτηση]\nΠαράδειγμα Σωστής Απάντησης Βοηθού: [Σαφής, βοηθητική, καθοδηγητική απάντηση βασισμένη στην προσωπικότητα/ύφος σου]' },
        { id: 'scaffold-hints-1', type: BlockTypes.PALETTE_ITEM, title: 'Παροχή Υποδείξεων', content: 'Εάν ένας μαθητής έχει κολλήσει, πρόσφερε μια μικρή υπόδειξη ή μια υπενθύμιση μιας σχετικής έννοιας πριν δώσεις πιο άμεση βοήθεια.' },
    ],
    '🛡️ Ασφάλεια & Δεοντολογία': [
        { id: 'safe-offtopic-1', type: BlockTypes.PALETTE_ITEM, title: 'Άρνηση Άσχετων Ερωτήσεων', content: 'Αρνήσου ευγενικά να απαντήσεις σε ερωτήσεις που είναι άσχετες με το μάθημα, ακατάλληλες, επιβλαβείς, ανήθικες ή ζητούν προσωπικές πληροφορίες.' },
        { id: 'safe-no-pii-1', type: BlockTypes.PALETTE_ITEM, title: 'Όχι Προσωπικά Δεδομένα', content: 'Μην ζητάς, αποθηκεύεις ή μοιράζεσαι ποτέ προσωπικά δεδομένα (ΠΔ) από ή για τον μαθητή ή άλλους.' },
    ]
};

// Μεταφρασμένα βήματα περιήγησης (unchanged copy/text)
const guidedSteps = [
    { selector: '.workshop-column.palette', content: '1. Βιβλιοθήκη Μπλοκ: Εδώ βρίσκονται έτοιμες παιδαγωγικές οδηγίες. Κάντε κλικ σε μία για να την προσθέσετε στον καμβά.' },
    { selector: '.workshop-column.canvas', content: '2. Καμβάς Οδηγιών: Συνθέστε τις οδηγίες του βοηθού εδώ. Σύρετε τα μπλοκ για να αλλάξετε τη σειρά τους.' },
    { selector: '.prompt-metadata-controls', content: '3. Λεπτομέρειες & Ενέργειες: Δώστε όνομα, περιγραφή και ορατότητα στον βοηθό σας. Από εδώ μπορείτε να αποθηκεύσετε, να φορτώσετε ή να προσθέσετε υλικό.' },
    { selector: '.workshop-column.sandbox', content: '4. Περιοχή Δοκιμών: Δοκιμάστε τον βοηθό σας σε πραγματικό χρόνο! Γράψτε μια ερώτηση μαθητή για να δείτε πώς απαντά.' }
];

function PromptWorkshop() {
    const [materials, setMaterials] = useState([]);
    const [savedPrompts, setSavedPrompts] = useState([]);
    const [currentPrompt, setCurrentPrompt] = useState({ id: null, name: '', description: '', is_public: false, structure: [], system_prompt: '' });
    const [activeId, setActiveId] = useState(null);
    const [loadingState, setLoadingState] = useState({ materials: true, prompts: true, promptDetails: false });
    const [isSaving, setIsSaving] = useState(false);
    const [messages, setMessages] = useState({ error: '', success: '' });
    const [showLoadPromptModal, setShowLoadPromptModal] = useState(false);
    const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);

    // --- Quick Tour state (enhanced) ---
    const [isTutorialActive, setIsTutorialActive] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(0);
    const highlightedElementRef = useRef(null);
    const tooltipRef = useRef(null);
    const [tooltipPos, setTooltipPos] = useState({ top: 24, left: 24, placement: 'right' });
    const [focusables, setFocusables] = useState([]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const clearMessages = useCallback(() => setMessages({ error: '', success: '' }), []);
    const showSuccess = useCallback((msg, dur = 3500) => { setMessages({ error: '', success: msg }); setTimeout(clearMessages, dur); }, [clearMessages]);
    const showError = useCallback((msg) => { setMessages({ error: msg, success: '' }); }, []);

    const fetchAllMaterials = useCallback(async () => {
        setLoadingState(s => ({ ...s, materials: true }));
        try {
            const r = await getMaterials();
            setMaterials(r.data || []);
        } catch (e) {
            console.error("Error fetching materials:", e);
            showError("Αδυναμία φόρτωσης υλικών.");
            setMaterials([]);
        } finally {
            setLoadingState(s => ({ ...s, materials: false }));
        }
    }, [showError]);

    const fetchAllPrompts = useCallback(async () => {
        setLoadingState(s => ({ ...s, prompts: true }));
        try {
            const r = await getTeacherPrompts();
            setSavedPrompts(r.data || []);
        } catch (e) {
            console.error("Error fetching prompts:", e);
            showError("Αδυναμία φόρτωσης αποθηκευμένων βοηθών.");
            setSavedPrompts([]);
        } finally {
            setLoadingState(s => ({ ...s, prompts: false }));
        }
    }, [showError]);

    useEffect(() => { fetchAllMaterials(); fetchAllPrompts(); }, [fetchAllMaterials, fetchAllPrompts]);

    const handleAddBlock = useCallback((blockFromPalette) => {
        clearMessages();
        const newBlock = {
            id: `canvas-${uuidv4()}`,
            type: BlockTypes.CANVAS_BLOCK,
            title: blockFromPalette.title,
            content: blockFromPalette.content,
        };
        setCurrentPrompt(p => ({ ...p, structure: [...p.structure, newBlock] }));
    }, [clearMessages]);

    const handleAddMaterialSummary = useCallback((material) => {
        clearMessages();
        if (!material?.id) { showError("Επιλέχθηκε μη έγκυρο υλικό."); return; }
        const summaryBlock = {
            id: `mat-${material.id}-${uuidv4()}`,
            type: BlockTypes.MATERIAL_SUMMARY,
            title: `📄 Πλαίσιο από: ${material.name}`,
            content: `[USE_FULL_TEXT_FROM_MATERIAL_ID:${material.id}] Πληροφορίες από το υλικό με τίτλο "${material.name}".`,
            isMaterialBlock: true,
            materialId: material.id,
            materialName: material.name
        };
        setCurrentPrompt(prev => ({ ...prev, structure: [...prev.structure, summaryBlock] }));
        showSuccess(`Προστέθηκε το πλαίσιο από "${material.name}" (το AI θα χρησιμοποιήσει το πλήρες κείμενο).`);
        setShowAddMaterialModal(false);
    }, [clearMessages, showError, showSuccess]);

    const handleAddCustomTextBlock = useCallback(() => {
        clearMessages();
        const nb = { id: `custom-${uuidv4()}`, type: BlockTypes.CUSTOM_TEXT, title: '✏️ Προσαρμοσμένη Οδηγία', content: 'Εισαγάγετε τη δική σας οδηγία...' };
        setCurrentPrompt(p => ({ ...p, structure: [...p.structure, nb] }));
    }, [clearMessages]);

    const handleDeleteBlock = useCallback((id) => {
        clearMessages();
        setCurrentPrompt(p => ({ ...p, structure: p.structure.filter(b => b.id !== id) }));
    }, [clearMessages]);

    const handleUpdateBlockContent = useCallback((id, content) => {
        clearMessages();
        setCurrentPrompt(p => ({ ...p, structure: p.structure.map(b => b.id === id ? { ...b, content } : b) }));
    }, [clearMessages]);

    const handlePromptNameChange = (e) => setCurrentPrompt(p => ({ ...p, name: e.target.value }));
    const handlePromptDescriptionChange = (e) => setCurrentPrompt(p => ({ ...p, description: e.target.value }));
    const handlePromptPublicToggle = (e) => setCurrentPrompt(p => ({ ...p, is_public: e.target.checked }));

    const handleSavePrompt = useCallback(async () => {
        clearMessages();
        if (!currentPrompt.name.trim()) { showError("Το όνομα του βοηθού AI είναι απαραίτητο."); return; }
        setIsSaving(true);
        const payload = {
            name: currentPrompt.name.trim(),
            description: currentPrompt.description.trim(),
            is_public: currentPrompt.is_public,
            structure: currentPrompt.structure
        };
        try {
            let response; let msg = '';
            if (currentPrompt.id) {
                response = await updatePrompt(currentPrompt.id, payload);
                msg = `Ο βοηθός "${response.data.name}" ενημερώθηκε επιτυχώς.`;
                setSavedPrompts(prev => prev.map(p => p.id === response.data.id ? { ...p, ...response.data } : p));
                const updatedDetails = await getPromptDetails(currentPrompt.id);
                setCurrentPrompt(prev => ({ ...prev, ...updatedDetails.data }));
            } else {
                response = await savePrompt(payload);
                msg = `Ο βοηθός "${response.data.name}" δημιουργήθηκε επιτυχώς.`;
                setCurrentPrompt(prev => ({ ...prev, id: response.data.id, ...response.data, system_prompt: response.data.system_prompt }));
                setSavedPrompts(prev => [response.data, ...prev]);
            }
            showSuccess(msg);
        } catch (err) {
            console.error("Error saving prompt:", err);
            showError(err.response?.data?.error || "Αποτυχία αποθήκευσης του βοηθού AI.");
        } finally {
            setIsSaving(false);
        }
    }, [currentPrompt, showError, showSuccess, clearMessages]);

    const handleLoadPrompt = useCallback(async (promptToLoad) => {
        clearMessages();
        if (!promptToLoad?.id) { showError("Επιλέχθηκε μη έγκυρος βοηθός."); setShowLoadPromptModal(false); return; }
        setLoadingState(s => ({ ...s, promptDetails: true }));
        try {
            const response = await getPromptDetails(promptToLoad.id);
            const fp = response.data;
            setCurrentPrompt({
                id: fp.id, name: fp.name || '', description: fp.description || '',
                is_public: !!fp.is_public,
                structure: Array.isArray(fp.structure) ? fp.structure : [],
                system_prompt: fp.system_prompt || ''
            });
            showSuccess(`Φορτώθηκε ο βοηθός: "${fp.name}"`);
        } catch (err) {
            console.error("Error loading prompt details:", err);
            showError(`Αποτυχία φόρτωσης του "${promptToLoad.name}".`);
        } finally {
            setLoadingState(s => ({ ...s, promptDetails: false }));
            setShowLoadPromptModal(false);
        }
    }, [showError, showSuccess, clearMessages]);

    const handleNewPrompt = useCallback(() => {
        clearMessages();
        setCurrentPrompt({ id: null, name: '', description: '', is_public: false, structure: [], system_prompt: '' });
        showSuccess("Ο καμβάς είναι έτοιμος για ένα νέο βοηθό.");
    }, [clearMessages, showSuccess]);

    const handleDragStart = (event) => { clearMessages(); setActiveId(event.active.id); };
    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveId(null);
        if (over && active.id !== over.id) {
            const oldIdx = currentPrompt.structure.findIndex(i => i.id === active.id);
            const newIdx = currentPrompt.structure.findIndex(i => i.id === over.id);
            if (oldIdx !== -1 && newIdx !== -1) {
                setCurrentPrompt(p => ({ ...p, structure: arrayMove(p.structure, oldIdx, newIdx) }));
            }
        }
    };
    const draggedBlockData = activeId ? currentPrompt.structure.find(b => b.id === activeId) : null;
    const systemPromptForSandbox = currentPrompt.system_prompt ? currentPrompt.system_prompt : currentPrompt.structure.map(block => block.content).join("\n\n");

    // -----------------------------
    // Quick Tour: helpers & effects
    // -----------------------------
    const startTutorial = () => {
        setIsTutorialActive(true);
        setTutorialStep(0);
    };
    const nextTutorialStep = () => {
   if (tutorialStep < guidedSteps.length - 1) {
     setTutorialStep(s => s + 1);
   } else {
     endTutorial();  // <-- κάλεσέ το για σωστό cleanup
   }
 };
    const prevTutorialStep = () => {
        if (tutorialStep > 0) setTutorialStep(s => s - 1);
    };
    const endTutorial = useCallback(() => {
        if (highlightedElementRef.current) {
            highlightedElementRef.current.classList.remove('tutorial-highlight');
            highlightedElementRef.current = null;
        }
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
        setFocusables([]);
        setIsTutorialActive(false);
        setTutorialStep(0);
    }, []);

    // Smart tooltip positioning near the highlighted element
    const positionTooltipFor = useCallback((element) => {
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const tW = (tooltipRef.current && tooltipRef.current.offsetWidth) || 360;
        const tH = (tooltipRef.current && tooltipRef.current.offsetHeight) || 180;
        const gap = 12;
        const pad = 12;

        // prefer right -> left -> bottom -> top
        let left = rect.right + gap;
        let top = rect.top + rect.height / 2 - tH / 2;
        let placement = 'right';

        const fitsRight = (left + tW + pad) <= window.innerWidth;
        const fitsLeft = (rect.left - gap - tW - pad) >= 0;
        const fitsBottom = (rect.bottom + gap + tH + pad) <= window.innerHeight;
        const fitsTop = (rect.top - gap - tH - pad) >= 0;

        if (!fitsRight) {
            if (fitsLeft) {
                left = rect.left - gap - tW;
                top = rect.top + rect.height / 2 - tH / 2;
                placement = 'left';
            } else if (fitsBottom) {
                left = rect.left + rect.width / 2 - tW / 2;
                top = rect.bottom + gap;
                placement = 'bottom';
            } else {
                left = rect.left + rect.width / 2 - tW / 2;
                top = rect.top - gap - tH;
                placement = 'top';
            }
        }

        // clamp into viewport
        left = Math.max(pad, Math.min(left, window.innerWidth - tW - pad));
        top = Math.max(pad, Math.min(top, window.innerHeight - tH - pad));

        setTooltipPos({ left, top, placement });
    }, []);

    // Reposition + highlight per step
    useEffect(() => {
        if (!isTutorialActive) return;

        // lock scroll while touring
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // remove previous highlight
        if (highlightedElementRef.current) {
            highlightedElementRef.current.classList.remove('tutorial-highlight');
            highlightedElementRef.current = null;
        }

        const step = guidedSteps[tutorialStep];
        let element = null;

        try {
            element = step && step.selector ? document.querySelector(step.selector) : null;
        } catch {
            element = null;
        }

        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            // adjust for sticky header
            setTimeout(() => {
                try { window.scrollBy({ top: -80, left: 0, behavior: 'auto' }); } catch {}
            }, 220);

            element.classList.add('tutorial-highlight');
            highlightedElementRef.current = element;

            // position the tooltip after it renders, then set focusables
            setTimeout(() => {
                positionTooltipFor(element);
                if (!tooltipRef.current) return;
                const selector = [
                    'button', '[href]', 'input', 'select', 'textarea',
                    '[tabindex]:not([tabindex="-1"])'
                ].join(',');
                const nodes = Array.from(tooltipRef.current.querySelectorAll(selector))
                    .filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
                setFocusables(nodes);
                const primary = tooltipRef.current.querySelector('.button.primary-button');
                (primary || nodes[0]) && (primary || nodes[0]).focus();
            }, 0);
        } else {
            // center tooltip if element missing
            setTooltipPos({
                top: window.innerHeight / 2 - 120,
                left: window.innerWidth / 2 - 200,
                placement: 'bottom'
            });
            setTimeout(() => {
                if (!tooltipRef.current) return;
                const selector = [
                    'button', '[href]', 'input', 'select', 'textarea',
                    '[tabindex]:not([tabindex="-1"])'
                ].join(',');
                const nodes = Array.from(tooltipRef.current.querySelectorAll(selector))
                    .filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
                setFocusables(nodes);
                const primary = tooltipRef.current.querySelector('.button.primary-button');
                (primary || nodes[0]) && (primary || nodes[0]).focus();
            }, 0);
        }

        const handleResize = () => {
            if (highlightedElementRef.current) positionTooltipFor(highlightedElementRef.current);
        };
        const handleScroll = () => {
            if (highlightedElementRef.current) positionTooltipFor(highlightedElementRef.current);
        };
        const handleKey = (e) => {
            if (!isTutorialActive) return;

            if (e.key === 'Escape') { e.preventDefault(); endTutorial(); return; }
            if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); nextTutorialStep(); return; }
            if (e.key === 'ArrowLeft') { e.preventDefault(); prevTutorialStep(); return; }

            // focus trap
            if (e.key === 'Tab' && focusables.length) {
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };

        window.addEventListener('resize', handleResize, { passive: true });
        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('keydown', handleKey);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('keydown', handleKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [isTutorialActive, tutorialStep, positionTooltipFor, endTutorial, focusables.length]);

    return (
        <div className="prompt-workshop-page page-content-wrapper">
            <div className="page-header">
                <h2><FaEdit /> Εργαστήρι Βοηθών AI</h2>
                <button onClick={startTutorial} className="button subtle-button">
                    <FaQuestion /> Γρήγορη Περιήγηση
                </button>
            </div>

            {(messages.error || messages.success) &&
                <div className={`message global-message ${messages.error ? 'error-message' : 'success-message'}`} role="status">
                    {messages.error || messages.success}
                    <button onClick={clearMessages} title="Απόκρυψη" aria-label="Dismiss">X</button>
                </div>
            }

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            >
                <div className="prompt-workshop-container">
                    <aside className="workshop-column palette">
                        <BlockPalette
                            blocksByCategory={initialPreMadeBlocks}
                            onAddBlock={handleAddBlock}
                            onAddCustom={handleAddCustomTextBlock}
                        />
                    </aside>

                    <main className="workshop-column canvas">
                        <div className="prompt-canvas-section widget">
                            <div className="prompt-metadata-controls">
                                <div className="prompt-meta-row-1">
                                    <input
                                        type="text"
                                        placeholder="Όνομα Βοηθού AI (Απαιτείται)"
                                        value={currentPrompt.name}
                                        onChange={handlePromptNameChange}
                                        className="prompt-name-input"
                                        required
                                        aria-label="Όνομα Βοηθού AI"
                                    />
                                    <div className="prompt-actions-main">
                                        <button className="button primary-button" onClick={handleSavePrompt} disabled={isSaving || !currentPrompt.name.trim()}>
                                            <FaSave /> {isSaving ? 'Αποθήκευση...' : (currentPrompt.id ? 'Ενημέρωση' : 'Αποθήκευση')}
                                        </button>
                                        <button onClick={handleNewPrompt} className="button subtle-button" title="Καθαρισμός & Νέος Βοηθός">
                                            <FaSyncAlt /> Νέος
                                        </button>
                                    </div>
                                </div>
                                <div className="prompt-meta-row-2">
                                    <textarea
                                        placeholder="Σύντομη περιγραφή για τους μαθητές (προαιρετικό)..."
                                        value={currentPrompt.description}
                                        onChange={handlePromptDescriptionChange}
                                        className="prompt-description-input"
                                        rows={2}
                                        aria-label="Σύντομη περιγραφή"
                                    />
                                </div>
                                <div className="prompt-actions-extra">
                                    <div className="prompt-load-add-buttons">
                                        <button className="button subtle-button" onClick={() => setShowAddMaterialModal(true)} title="Προσθήκη πλαισίου από το υλικό σας">
                                            <FaFileUpload /> Προσθήκη Υλικού
                                        </button>
                                        <button className="button subtle-button" onClick={() => setShowLoadPromptModal(true)} title="Φόρτωση αποθηκευμένου βοηθού">
                                            <FaHistory /> Φόρτωση Βοηθού
                                        </button>
                                    </div>
                                    <div className="prompt-public-toggle">
                                        <input
                                            type="checkbox"
                                            id={`is_public_toggle_PW_${currentPrompt.id || 'newP'}`}
                                            checked={currentPrompt.is_public}
                                            onChange={handlePromptPublicToggle}
                                            disabled={isSaving}
                                        />
                                        <label
                                            htmlFor={`is_public_toggle_PW_${currentPrompt.id || 'newP'}`}
                                            className={currentPrompt.is_public ? 'is-public' : ''}
                                            title="Να είναι διαθέσιμος στους μαθητές;"
                                        >
                                            {currentPrompt.is_public ? 'Δημόσιος (Για μαθητές)' : 'Ιδιωτικός (Μόνο για εκπαιδευτικούς)'}
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <SortableContext items={currentPrompt.structure.map(b => b.id)} strategy={verticalListSortingStrategy}>
                                <PromptBuilder
                                    blocks={currentPrompt.structure}
                                    onDeleteBlock={handleDeleteBlock}
                                    onUpdateBlockContent={handleUpdateBlockContent}
                                    activeId={activeId}
                                />
                            </SortableContext>
                        </div>
                    </main>

                    <aside className="workshop-column sandbox">
                        <Sandbox
                            currentPromptStructure={currentPrompt.structure}
                            systemPromptForSandbox={systemPromptForSandbox}
                            promptIdToUseIfNoStructure={currentPrompt.id}
                            showError={showError}
                            showSuccess={showSuccess}
                            clearMessages={clearMessages}
                        />
                    </aside>
                </div>

                <DragOverlay dropAnimation={null}>
                    {activeId && draggedBlockData ? (
                        <SortableBlock
                            id={draggedBlockData.id}
                            block={draggedBlockData}
                            isDragging={true}
                            onDeleteBlock={() => {}}
                            onUpdateBlockContent={() => {}}
                        />
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Modals (unchanged) */}
            {showLoadPromptModal && (
                <Modal title="Φόρτωση Αποθηκευμένου Βοηθού" onClose={() => setShowLoadPromptModal(false)} width="700px" showFooter={true}>
                    {loadingState.promptDetails ? (
                        <div className="loading-items modal-loading"><FaSpinner className="spin" /> Λήψη λεπτομερειών...</div>
                    ) : (
                        <PromptListForModal
                            prompts={savedPrompts}
                            onLoadPrompt={handleLoadPrompt}
                            isLoading={loadingState.prompts}
                            currentPromptId={currentPrompt.id}
                            showError={showError}
                        />
                    )}
                </Modal>
            )}
            {showAddMaterialModal && (
                <Modal title="Προσθήκη Πλαισίου από Υλικό" onClose={() => setShowAddMaterialModal(false)} width="700px" showFooter={true}>
                    <MaterialListForModal
                        materials={materials}
                        onMaterialClick={handleAddMaterialSummary}
                        isLoading={loadingState.materials}
                        showError={showError}
                    />
                </Modal>
            )}

            {/* --- ENHANCED QUICK TOUR OVERLAY --- */}
            {isTutorialActive && guidedSteps[tutorialStep] && (
                <>
                    <div className="tutorial-overlay-backdrop" onClick={endTutorial} aria-hidden="true" />
                    <div
                        ref={tooltipRef}
                        className="tutorial-tooltip"
                        style={{ top: tooltipPos.top, left: tooltipPos.left, position: 'fixed' }}
                        data-placement={tooltipPos.placement}
                        role="dialog"
                        aria-modal="true"
                        aria-live="polite"
                    >
                        <p>{guidedSteps[tutorialStep].content}</p>

                        <div className="tutorial-footer">
                            <span>Βήμα {tutorialStep + 1} από {guidedSteps.length}</span>
                            <div className="tutorial-buttons">
                                {tutorialStep > 0 && (
                                    <button onClick={prevTutorialStep} className='button subtle-button small' autoFocus>
                                        Προηγούμενο
                                    </button>
                                )}
                                <button onClick={endTutorial} className='button subtle-button small close-tutorial'>
                                    Παράλειψη
                                </button>
                                <button onClick={nextTutorialStep} className='button primary-button small'>
                                    {tutorialStep < guidedSteps.length - 1 ? 'Επόμενο' : 'Τέλος'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default PromptWorkshop;
