(function () {
    "use strict";

    const ALL_SCRIPTS = [
        { id: "itrans",           label: "ITRANS" },
        { id: "iast",             label: "IAST" },
        { id: "devanagari",       label: "Devanagari (\u0905)" },
        { id: "bengali",          label: "Bengali (\u0985)" },
        { id: "oriya",            label: "Odia / Oriya (\u0B05)" },
        { id: "gujarati",         label: "Gujarati (\u0A85)" },
        { id: "gurmukhi",         label: "Gurmukhi (\u0A05)" },
        { id: "kannada",          label: "Kannada (\u0C85)" },
        { id: "malayalam",        label: "Malayalam (\u0D05)" },
        { id: "tamil",            label: "Tamil (\u0B85)" },
        { id: "telugu",           label: "Telugu (\u0C05)" },
        { id: "hk",               label: "Harvard-Kyoto (HK)" },
        { id: "slp1",             label: "SLP1" },
        { id: "velthuis",         label: "Velthuis" },
        { id: "wx",               label: "WX" },
        { id: "kolkata",          label: "Kolkata (National Library)" },
        { id: "itrans_dravidian", label: "ITRANS (Dravidian)" }
    ];

    const STORAGE_KEY = "ostt_user_preferences_v1";

    const DEFAULT_SETTINGS = {
        enableAutoDetect: "no",
        syncope: "0",
        dualGrouping: "stanza",
        brahmicFont: "Mangal",
        romanFont: "Calibri",
        fontSize: 18,
        autoMode: true,
        syncScroll: true,
        inputScripts: ["itrans", "iast", "devanagari", "bengali", "oriya"],
        outputScripts: ["devanagari", "iast", "itrans", "bengali", "oriya"],
        selectedInput: "itrans",
        selectedOutput: "devanagari",
        dualMode: false,
        secondaryOutput: "iast"
    };

    let state = loadState();

    const inputSelect = document.getElementById("inputSelect");
    const outputSelect = document.getElementById("outputSelect");
    const secondaryOutputSelect = document.getElementById("secondaryOutputSelect");
    const dualModeCheck = document.getElementById("dualModeCheck");
    const inputText = document.getElementById("inputText");
    const outputText = document.getElementById("outputText");
    const autoModeCheck = document.getElementById("autoMode");
    const syncScrollCheck = document.getElementById("syncScroll");
    const runBtn = document.getElementById("runBtn");
    const swapBtn = document.getElementById("swapBtn");
    const detectedBadge = document.getElementById("detectedBadge");
    const inputStats = document.getElementById("inputStats");
    const outputStats = document.getElementById("outputStats");
    const modeIndicator = document.getElementById("modeIndicator");
    const fontSizeLabel = document.getElementById("fontSizeLabel");

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            return Object.assign(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), JSON.parse(raw));
        } catch (e) {
            return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        }
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {}
    }

    function getScriptLabel(id) {
        const found = ALL_SCRIPTS.find(s => s.id === id);
        return found ? found.label : id;
    }

    function renderDropdowns() {
        inputSelect.innerHTML = "";
        if (state.enableAutoDetect === "yes") {
            const autoOpt = document.createElement("option");
            autoOpt.value = "auto";
            autoOpt.textContent = "Auto-Detect Script";
            inputSelect.appendChild(autoOpt);
        }

        state.inputScripts.forEach(id => {
            const opt = document.createElement("option");
            opt.value = id;
            opt.textContent = getScriptLabel(id);
            inputSelect.appendChild(opt);
        });

        if (state.selectedInput === "auto" && state.enableAutoDetect !== "yes") {
            state.selectedInput = state.inputScripts[0] || "itrans";
        } else if (state.selectedInput !== "auto" && !state.inputScripts.includes(state.selectedInput)) {
            state.selectedInput = state.inputScripts[0] || "itrans";
        }
        inputSelect.value = state.selectedInput;

        outputSelect.innerHTML = "";
        state.outputScripts.forEach(id => {
            const opt = document.createElement("option");
            opt.value = id;
            opt.textContent = getScriptLabel(id);
            outputSelect.appendChild(opt);
            if (id === "devanagari") {
                const comboOpt = document.createElement("option");
                comboOpt.value = "devanagari_iast";
                comboOpt.textContent = "Devanagari + IAST";
                outputSelect.appendChild(comboOpt);
            }
        });

        if (state.selectedOutput !== "devanagari_iast" && !state.outputScripts.includes(state.selectedOutput)) {
            state.selectedOutput = state.outputScripts[0] || "devanagari";
        }
        outputSelect.value = state.selectedOutput;

        secondaryOutputSelect.innerHTML = "";
        ALL_SCRIPTS.forEach(s => {
            const opt = document.createElement("option");
            opt.value = s.id;
            opt.textContent = s.label;
            secondaryOutputSelect.appendChild(opt);
        });
        secondaryOutputSelect.value = state.secondaryOutput || "iast";
    }

    function resolveInputScheme(text) {
        if (inputSelect.value === "auto") {
            if (!text.trim()) {
                detectedBadge.classList.add("hidden");
                return "itrans";
            }
            const detected = (window.sanskrit && window.sanskrit.detect)
                ? window.sanskrit.detect(text)
                : "itrans";
            detectedBadge.textContent = "Detected: " + getScriptLabel(detected);
            detectedBadge.classList.remove("hidden");
            return detected;
        }
        detectedBadge.classList.add("hidden");
        return inputSelect.value;
    }

    function runTransliteration() {
        const rawText = inputText.value;
        updateStats();

        if (!rawText.trim()) {
            outputText.value = "";
            detectedBadge.classList.add("hidden");
            updateStats();
            return;
        }

        const from = resolveInputScheme(rawText);
        const to = outputSelect.value;
        const options = { syncope: state.syncope === "1" };

        const isPresetDual = (to === "devanagari_iast");
        const isCustomDual = state.dualMode && !isPresetDual;

        if (isPresetDual || isCustomDual) {
            const primaryScheme = isPresetDual ? "devanagari" : to;
            const secondaryScheme = isPresetDual ? "iast" : secondaryOutputSelect.value;
            const normalized = rawText.replace(/\r\n/g, "\n");

            if (state.dualGrouping === "line") {
                const lines = normalized.split("\n");
                const outPairs = [];
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (!line.trim()) continue;
                    const p = Sanscript.t(line, from, primaryScheme, options).trim();
                    const s = Sanscript.t(line, from, secondaryScheme, options).trim();
                    outPairs.push(p + "\n" + s);
                }
                outputText.value = outPairs.join("\n\n");
            } else {
                const blocks = normalized.split(/\n\s*\n/);
                const outputBlocks = [];
                for (let i = 0; i < blocks.length; i++) {
                    const block = blocks[i];
                    if (!block.trim()) continue;
                    const p = Sanscript.t(block, from, primaryScheme, options).trim();
                    const s = Sanscript.t(block, from, secondaryScheme, options).trim();
                    outputBlocks.push(p + "\n" + s);
                }
                outputText.value = outputBlocks.join("\n\n");
            }
        } else {
            outputText.value = Sanscript.t(rawText, from, to, options);
        }

        updateStats();
    }

    function updateStats() {
        const inVal = inputText.value;
        const outVal = outputText.value;
        const inLines = inVal ? inVal.split(/\r\n|\r|\n/).length : 0;
        const outLines = outVal ? outVal.split(/\r\n|\r|\n/).length : 0;

        inputStats.textContent = `${inVal.length} chars | ${inLines} lines`;
        outputStats.textContent = `${outVal.length} chars | ${outLines} lines`;
        modeIndicator.textContent = state.syncope === "1"
            ? "Mode: Hindi / Marathi (\u0905\u091C\u092F)"
            : "Mode: Sanskrit (\u0905\u091C\u092F\u094D)";
    }

    function updateCharacterMap() {
        let from = inputSelect.value === "auto" ? resolveInputScheme(inputText.value) : inputSelect.value;
        let to = outputSelect.value === "devanagari_iast" ? "devanagari" : outputSelect.value;

        const fromMap = Sanscript.schemes[from] || Sanscript.schemes["itrans"];
        const toMap = Sanscript.schemes[to] || Sanscript.schemes["devanagari"];

        document.getElementById("mapModalTitle").textContent =
            `Character Map: ${getScriptLabel(from)} -> ${getScriptLabel(to)}`;

        const groups = ["vowels", "other_marks", "consonants", "symbols", "other"];
        groups.forEach(group => {
            const container = document.getElementById("m-" + group);
            if (!container) return;
            container.innerHTML = "";

            const fList = fromMap[group] || [];
            const tList = toMap[group] || [];
            const len = Math.max(fList.length, tList.length);

            for (let i = 0; i < len; i++) {
                const fChar = fList[i] || "[none]";
                const tChar = tList[i] || "[none]";
                if (fChar === "[none]" && tChar === "[none]") continue;

                const cell = document.createElement("div");
                cell.className = "map-cell";
                cell.innerHTML = `<span class="target-char">${tChar}</span><span class="source-char">${fChar}</span>`;
                container.appendChild(cell);
            }
        });
    }

    function swapSides() {
        const currentFrom = inputSelect.value === "auto"
            ? resolveInputScheme(inputText.value)
            : inputSelect.value;
        const currentTo = outputSelect.value;

        if (currentTo === "devanagari_iast" || state.dualMode) {
            alert("Please disable Dual-Script output ('Devanagari + IAST' or '+ 2nd Script') before swapping sides.");
            return;
        }

        if (!state.inputScripts.includes(currentTo)) state.inputScripts.push(currentTo);
        if (!state.outputScripts.includes(currentFrom)) state.outputScripts.push(currentFrom);

        state.selectedInput = currentTo;
        state.selectedOutput = currentFrom;
        renderDropdowns();
        saveState();

        const temp = inputText.value;
        inputText.value = outputText.value;
        outputText.value = temp;

        if (state.autoMode) runTransliteration();
        updateStats();
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function isBrahmicLine(line, fallbackScheme) {
        // Check if line contains Indic Unicode block characters (Devanagari through Malayalam)
        if (/[\u0900-\u0D7F]/.test(line)) return true;
        if (/[a-zA-Z\u0100-\u024F\u1E00-\u1EFF]/.test(line)) return false;
        return fallbackScheme ? !Sanscript.isRomanScheme(fallbackScheme) : false;
    }

    function buildWordRichHtml(text, defaultScheme) {
        const brahmicFont = state.brahmicFont || "Mangal";
        const romanFont = state.romanFont || "Calibri";
        const ptSize = Math.round((state.fontSize || 18) * 0.75);

        const lines = text.replace(/\r\n/g, "\n").split("\n");
        const htmlParagraphs = lines.map(line => {
            if (!line.trim()) {
                return `<p style="margin:0; font-size:${ptSize}pt;">&nbsp;</p>`;
            }
            const useBrahmic = isBrahmicLine(line, defaultScheme);
            const fontName = useBrahmic ? brahmicFont : romanFont;
            return `<p style="margin:0; font-family:'${fontName}', sans-serif; font-size:${ptSize}pt; line-height:1.5;">${escapeHtml(line)}</p>`;
        }).join("");

        return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><!--StartFragment-->${htmlParagraphs}<!--EndFragment--></body></html>`;
    }

    async function copyWithFeedback(text, btnElement, defaultScheme) {
        if (!text) return;
        try {
            if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
                const htmlContent = buildWordRichHtml(text, defaultScheme);
                const item = new ClipboardItem({
                    "text/plain": new Blob([text], { type: "text/plain" }),
                    "text/html": new Blob([htmlContent], { type: "text/html" })
                });
                await navigator.clipboard.write([item]);
            } else {
                await navigator.clipboard.writeText(text);
            }
        } catch (e) {
            try {
                await navigator.clipboard.writeText(text);
            } catch (err) {
                return;
            }
        }

        const textSpan = btnElement.querySelector(".btn-text");
        const orig = textSpan.textContent;
        btnElement.classList.add("copied");
        textSpan.textContent = "\u2713 Copied";
        setTimeout(() => {
            btnElement.classList.remove("copied");
            textSpan.textContent = orig;
        }, 1400);
    }

    function openSettingsModal() {
        document.getElementById("settingAutoDetect").value = state.enableAutoDetect;
        document.getElementById("settingSyncope").value = state.syncope;
        document.getElementById("settingDualGrouping").value = state.dualGrouping;
        document.getElementById("settingBrahmicFont").value = state.brahmicFont || "Mangal";
        document.getElementById("settingRomanFont").value = state.romanFont || "Calibri";

        const inBox = document.getElementById("inputScriptsChecklist");
        const outBox = document.getElementById("outputScriptsChecklist");
        inBox.innerHTML = "";
        outBox.innerHTML = "";

        ALL_SCRIPTS.forEach(script => {
            inBox.appendChild(createScriptCheckbox("in", script.id, script.label, state.inputScripts.includes(script.id)));
            outBox.appendChild(createScriptCheckbox("out", script.id, script.label, state.outputScripts.includes(script.id)));
        });

        document.getElementById("settingsModal").classList.remove("hidden");
    }

    function createScriptCheckbox(prefix, id, label, checked) {
        const lbl = document.createElement("label");
        lbl.className = "script-check-item";
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.value = id;
        chk.checked = checked;
        chk.dataset.group = prefix;
        lbl.appendChild(chk);
        lbl.appendChild(document.createTextNode(label));
        return lbl;
    }

    function applySettingsFromModal() {
        const inChecked = Array.from(document.querySelectorAll('input[data-group="in"]:checked')).map(c => c.value);
        const outChecked = Array.from(document.querySelectorAll('input[data-group="out"]:checked')).map(c => c.value);

        if (inChecked.length === 0 || outChecked.length === 0) {
            alert("Please select at least one script for both Input and Output boxes.");
            return;
        }

        state.enableAutoDetect = document.getElementById("settingAutoDetect").value;
        state.syncope = document.getElementById("settingSyncope").value;
        state.dualGrouping = document.getElementById("settingDualGrouping").value;
        state.brahmicFont = document.getElementById("settingBrahmicFont").value;
        state.romanFont = document.getElementById("settingRomanFont").value;
        state.inputScripts = inChecked;
        state.outputScripts = outChecked;

        saveState();
        renderDropdowns();
        runTransliteration();
        document.getElementById("settingsModal").classList.add("hidden");
    }

    function applyFontSize() {
        document.documentElement.style.setProperty("--editor-font-size", state.fontSize + "px");
        fontSizeLabel.textContent = state.fontSize + "px";
    }

    // Strict non-editable guard on outputText while preserving selection, copy, and Ctrl+F
    outputText.addEventListener("beforeinput", (e) => {
        e.preventDefault();
    });
    outputText.addEventListener("paste", (e) => {
        e.preventDefault();
    });
    outputText.addEventListener("cut", (e) => {
        e.preventDefault();
    });

    // Block unwanted browser reload/print/source shortcuts while allowing Ctrl+F (Find on Page)
    window.addEventListener("keydown", (e) => {
        const key = e.key.toLowerCase();
        if (
            e.key === "F5" ||
            e.key === "F12" ||
            ((e.ctrlKey || e.metaKey) && (key === "r" || key === "p" || key === "u")) ||
            ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === "i" || key === "j" || key === "c"))
        ) {
            e.preventDefault();
        }
    });

    let isSyncingLeft = false;
    let isSyncingRight = false;
    inputText.addEventListener("scroll", () => {
        if (!state.syncScroll || isSyncingLeft) { isSyncingLeft = false; return; }
        isSyncingRight = true;
        const percentage = inputText.scrollTop / (inputText.scrollHeight - inputText.clientHeight || 1);
        outputText.scrollTop = percentage * (outputText.scrollHeight - outputText.clientHeight);
    });
    outputText.addEventListener("scroll", () => {
        if (!state.syncScroll || isSyncingRight) { isSyncingRight = false; return; }
        isSyncingLeft = true;
        const percentage = outputText.scrollTop / (outputText.scrollHeight - outputText.clientHeight || 1);
        inputText.scrollTop = percentage * (inputText.scrollHeight - inputText.clientHeight);
    });

    inputText.addEventListener("input", () => {
        if (state.autoMode) runTransliteration();
        else updateStats();
    });

    inputSelect.addEventListener("change", () => {
        state.selectedInput = inputSelect.value;
        saveState();
        if (state.autoMode) runTransliteration();
    });

    outputSelect.addEventListener("change", () => {
        state.selectedOutput = outputSelect.value;
        if (outputSelect.value === "devanagari_iast") {
            dualModeCheck.checked = false;
            state.dualMode = false;
            secondaryOutputSelect.classList.add("hidden");
        }
        saveState();
        if (state.autoMode) runTransliteration();
    });

    dualModeCheck.addEventListener("change", () => {
        state.dualMode = dualModeCheck.checked;
        if (state.dualMode && outputSelect.value === "devanagari_iast") {
            outputSelect.value = "devanagari";
            state.selectedOutput = "devanagari";
        }
        secondaryOutputSelect.classList.toggle("hidden", !state.dualMode);
        saveState();
        if (state.autoMode) runTransliteration();
    });

    secondaryOutputSelect.addEventListener("change", () => {
        state.secondaryOutput = secondaryOutputSelect.value;
        saveState();
        if (state.autoMode) runTransliteration();
    });

    autoModeCheck.addEventListener("change", () => {
        state.autoMode = autoModeCheck.checked;
        runBtn.classList.toggle("hidden", state.autoMode);
        saveState();
        if (state.autoMode) runTransliteration();
    });

    syncScrollCheck.addEventListener("change", () => {
        state.syncScroll = syncScrollCheck.checked;
        saveState();
    });

    runBtn.addEventListener("click", runTransliteration);
    swapBtn.addEventListener("click", swapSides);

    document.getElementById("copyInputBtn").addEventListener("click", function () {
        const inScheme = inputSelect.value === "auto" ? resolveInputScheme(inputText.value) : inputSelect.value;
        copyWithFeedback(inputText.value, this, inScheme);
    });
    document.getElementById("copyOutputBtn").addEventListener("click", function () {
        const outScheme = outputSelect.value === "devanagari_iast" ? "devanagari" : outputSelect.value;
        copyWithFeedback(outputText.value, this, outScheme);
    });
    document.getElementById("clearInputBtn").addEventListener("click", () => {
        inputText.value = "";
        outputText.value = "";
        detectedBadge.classList.add("hidden");
        updateStats();
        inputText.focus();
    });
    document.getElementById("pasteInputBtn").addEventListener("click", async () => {
        try {
            const clip = await navigator.clipboard.readText();
            inputText.value = clip;
            if (state.autoMode) runTransliteration();
            else updateStats();
        } catch (e) {}
    });

    document.getElementById("downloadOutputBtn").addEventListener("click", async () => {
        if (!outputText.value.trim()) return;
        const defaultName = `transliteration_${outputSelect.value}.txt`;

        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: defaultName,
                    types: [{
                        description: "UTF-8 Text File",
                        accept: { "text/plain": [".txt"] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(outputText.value);
                await writable.close();
                return;
            } catch (err) {
                if (err && err.name === "AbortError") return;
            }
        }

        const blob = new Blob([outputText.value], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = defaultName;
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById("fontDecBtn").addEventListener("click", () => {
        if (state.fontSize > 12) { state.fontSize -= 2; applyFontSize(); saveState(); }
    });
    document.getElementById("fontIncBtn").addEventListener("click", () => {
        if (state.fontSize < 36) { state.fontSize += 2; applyFontSize(); saveState(); }
    });

    document.getElementById("settingsBtn").addEventListener("click", openSettingsModal);
    document.getElementById("saveSettingsBtn").addEventListener("click", applySettingsFromModal);

    document.getElementById("mapBtn").addEventListener("click", () => {
        updateCharacterMap();
        document.getElementById("mapModal").classList.remove("hidden");
    });
    document.getElementById("helpBtn").addEventListener("click", () => {
        document.getElementById("helpModal").classList.remove("hidden");
    });

document.querySelectorAll(".modal-close").forEach(btn => {
        btn.addEventListener("click", () => {
            document.getElementById(btn.dataset.close).classList.add("hidden");
        });
    });

    // Close modal when clicking outside the modal card (on the dimmed backdrop)
    document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
        backdrop.addEventListener("click", (e) => {
            if (e.target === backdrop) {
                backdrop.classList.add("hidden");
            }
        });
    });

    // Close any open modal when pressing the Escape key
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach(modal => {
                modal.classList.add("hidden");
            });
        }
    });

    document.getElementById("selectAllScriptsBtn").addEventListener("click", () => {
        document.querySelectorAll('#settingsModal input[type="checkbox"]').forEach(c => c.checked = true);
    });
    document.getElementById("resetDefaultScriptsBtn").addEventListener("click", () => {
        const defIn = DEFAULT_SETTINGS.inputScripts;
        const defOut = DEFAULT_SETTINGS.outputScripts;
        document.querySelectorAll('input[data-group="in"]').forEach(c => c.checked = defIn.includes(c.value));
        document.querySelectorAll('input[data-group="out"]').forEach(c => c.checked = defOut.includes(c.value));
    });

    autoModeCheck.checked = state.autoMode;
    syncScrollCheck.checked = state.syncScroll;
    dualModeCheck.checked = state.dualMode;
    secondaryOutputSelect.classList.toggle("hidden", !state.dualMode);
    runBtn.classList.toggle("hidden", state.autoMode);
    applyFontSize();
    renderDropdowns();
    updateStats();
})();