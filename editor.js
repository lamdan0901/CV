document.addEventListener("DOMContentLoaded", () => {
  setupEditor();
});

function setupEditor() {
  // 1. Identify and make elements editable
  const editableAreas = [
    // Personal Info
    { selector: ".info h1", name: "Name" },
    { selector: ".info-item span", name: "Contact Detail" },
    { selector: ".info-item a", name: "Contact Link" },

    // Summary
    { selector: ".summary-section", name: "Summary" },

    // Work Experience
    { selector: ".job-grid", name: "Job Grid" }, // Allows editing dates/companies
    { selector: ".work-exp ul", name: "Job Responsibilities" },

    // Projects
    { selector: ".projects ul", name: "Projects List" },

    // Skills
    { selector: ".skills ul", name: "Skills List" },
  ];

  editableAreas.forEach((area) => {
    const elements = document.querySelectorAll(area.selector);
    elements.forEach((el) => {
      el.contentEditable = "true";
      el.classList.add("editable-field");
      el.setAttribute("data-label", area.name);

      // Add listeners for better UX
      el.addEventListener("focus", () => el.classList.add("editing"));
      el.addEventListener("blur", () => el.classList.remove("editing"));
    });
  });

  // 2. Setup Toolbar
  const pdfBtn = document.getElementById("save-pdf-btn");
  if (pdfBtn) {
    pdfBtn.addEventListener("click", async () => {
      if (validateForm()) {
        await handleGlobalSave(editableAreas, false);
        generatePDF();
      }
    });
  }

  // 3. Setup Floating Format Toolbar
  setupFloatingToolbar();

  // 4. Setup Print Listeners
  setupPrintHandling();

  // 5. Setup Persistence
  setupPersistence(editableAreas);
}

function setupPrintHandling() {
  window.addEventListener("beforeprint", () => {
    // Disable contentEditable before printing to ensure text is selectable in PDF
    const editableElements = document.querySelectorAll(
      '[contenteditable="true"]',
    );
    editableElements.forEach((el) => {
      el.contentEditable = "false";
      el.dataset.wasEditable = "true"; // Mark so we can restore later
    });
  });

  window.addEventListener("afterprint", () => {
    // Restore contentEditable after printing
    const editableElements = document.querySelectorAll(
      '[data-was-editable="true"]',
    );
    editableElements.forEach((el) => {
      el.contentEditable = "true";
      delete el.dataset.wasEditable;
    });
  });
}

function setupFloatingToolbar() {
  const toolbar = document.getElementById("format-toolbar");
  const buttons = toolbar.querySelectorAll("button");

  // Handle Selection
  document.addEventListener("selectionchange", () => {
    const toolbar = document.getElementById("format-toolbar");
    const selection = window.getSelection();

    // Hide if no selection or collapsed
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      if (toolbar) toolbar.style.display = "none";
      return;
    }

    // Check if selection is within an editable field
    let node = selection.anchorNode;
    let isEditable = false;

    // Traverse up to find .editable-field
    while (node && node !== document.body) {
      if (node.classList && node.classList.contains("editable-field")) {
        isEditable = true;
        break;
      }
      node = node.parentElement;
    }

    if (!isEditable || !toolbar) {
      if (toolbar) toolbar.style.display = "none";
      return;
    }

    // Position Toolbar logic
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    toolbar.style.display = "flex";

    // Detect if selection is inside a link
    let isLink = false;
    let currentNode = selection.anchorNode;
    while (currentNode && currentNode !== document.body) {
      if (currentNode.tagName === "A") {
        isLink = true;
        break;
      }
      currentNode = currentNode.parentElement;
    }

    // Toggle Unlink Button
    const unlinkBtn = toolbar.querySelector('button[data-command="unlink"]');
    if (unlinkBtn) {
      unlinkBtn.style.display = isLink ? "flex" : "none";
    }

    const toolbarHeight = toolbar.offsetHeight || 36; // fallback
    const toolbarWidth = toolbar.offsetWidth || 140; // fallback

    // Calculate position relative to viewport + scroll
    let top = rect.top + window.scrollY - toolbarHeight - 8;
    let left = rect.left + window.scrollX + rect.width / 2 - toolbarWidth / 2;

    // Prevent going off-screen top
    if (rect.top - toolbarHeight - 8 < 0) {
      top = rect.bottom + window.scrollY + 8;
    }

    toolbar.style.top = `${top}px`;
    toolbar.style.left = `${left}px`;
  });

  // Handle Buttons
  if (buttons) {
    buttons.forEach((btn) => {
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault(); // Prevent losing focus/selection
        const command = btn.getAttribute("data-command");

        if (command === "createLink") {
          const url = prompt("Enter link URL:", "https://");
          if (url) {
            document.execCommand(command, false, url);
          }
        } else if (command === "unlink") {
          // Custom unlink logic to remove entire link
          const selection = window.getSelection();
          if (!selection.rangeCount) return;

          let node = selection.anchorNode;
          // Find closest anchor tag
          while (node && node !== document.body) {
            if (node.tagName === "A") {
              break;
            }
            node = node.parentElement;
          }

          if (node && node.tagName === "A") {
            // Create a range selecting the entire anchor
            const range = document.createRange();
            range.selectNode(node);
            selection.removeAllRanges();
            selection.addRange(range);

            // Execute unlink
            document.execCommand("unlink", false, null);

            // Clean up potential mess left by execCommand
            // Sometimes it leaves spans with styles.
            // Let's replace the node content if it got wrapped weirdly
            // Or we can just use manual replacement which is safer:
            /*
             const parent = node.parentNode;
             while (node.firstChild) {
                 parent.insertBefore(node.firstChild, node);
             }
             parent.removeChild(node);
             */
            // But execCommand preserves undo history better usually.
            // If user complains about style, we might want to strip style attributes from the selection

            // Remove any style attributes that might have been added
            const parent = selection.anchorNode.parentElement;
            if (parent.tagName === "SPAN" && parent.getAttribute("style")) {
              // Unwrap span if it was added
              const grandParent = parent.parentNode;
              while (parent.firstChild)
                grandParent.insertBefore(parent.firstChild, parent);
              grandParent.removeChild(parent);
            }
          }
        } else {
          document.execCommand(command, false, null);
        }
      });
    });
  }
}

function validateForm() {
  let isValid = true;
  const requiredSelectors = [".info h1", ".info-item span"]; // Name and Contact details

  requiredSelectors.forEach((selector) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => {
      if (!el.textContent.trim()) {
        isValid = false;
        el.style.backgroundColor = "#ffe6e6"; // Highlight error
        el.style.outline = "2px solid red";

        // Remove error style on input
        const removeError = () => {
          el.style.backgroundColor = "";
          el.style.outline = "";
          el.removeEventListener("input", removeError);
        };
        el.addEventListener("input", removeError);
      }
    });
  });

  if (!isValid) {
    alert(
      "Please fill in all required fields (Name, Contact Info) before saving.",
    );
  }

  return isValid;
}

function generatePDF() {
  // Use browser's built-in print functionality for selectable text
  // Manually disable contentEditable before printing to ensure text is selectable
  // This is redundant with the 'beforeprint' listener but ensures it works for the button click

  const editableElements = document.querySelectorAll(
    '[contenteditable="true"]',
  );
  editableElements.forEach((el) => {
    el.contentEditable = "false";
    el.dataset.wasEditable = "true";
  });

  window.print();

  // Restore contentEditable after printing (in case afterprint didn't catch it)
  // Note: window.print() is blocking, so this runs after dialog closes
  const elementsToRestore = document.querySelectorAll(
    '[data-was-editable="true"]',
  );
  elementsToRestore.forEach((el) => {
    el.contentEditable = "true";
    delete el.dataset.wasEditable;
  });
}

/* Persistence Logic */

function setupPersistence(editableAreas) {
  // Load initial data
  loadFromLocal(editableAreas);

  // Auto-save on input
  document.addEventListener("input", (e) => {
    if (e.target.classList.contains("editable-field")) {
      saveToLocal(editableAreas);
    }
  });

  // Buttons
  const saveBtn = document.getElementById("save-local-btn");
  const exportBtn = document.getElementById("export-json-btn");
  const importBtn = document.getElementById("import-json-btn");
  const fileInput = document.getElementById("file-input");
  const cloudBtn = document.getElementById("cloud-sync-btn");

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      handleGlobalSave(editableAreas, true);
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", () => exportJSON(editableAreas));
  }

  if (importBtn) {
    importBtn.addEventListener("click", () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => importJSON(e, editableAreas));
  }

  if (cloudBtn) {
    cloudBtn.addEventListener("click", openCloudModal);
  }

  // Modal Logic
  setupCloudModal(editableAreas);
}

function getEditableData(editableAreas) {
  const data = {};
  editableAreas.forEach((area) => {
    const elements = document.querySelectorAll(area.selector);
    data[area.selector] = Array.from(elements).map((el) => el.innerHTML);
  });
  return data;
}

function setEditableData(data, editableAreas) {
  if (!data) return;

  editableAreas.forEach((area) => {
    if (data[area.selector]) {
      const elements = document.querySelectorAll(area.selector);
      data[area.selector].forEach((html, index) => {
        if (elements[index]) {
          elements[index].innerHTML = html;
        }
      });
    }
  });
}

function saveToLocal(editableAreas) {
  const data = getEditableData(editableAreas);
  localStorage.setItem("cv_data", JSON.stringify(data));
}

function loadFromLocal(editableAreas) {
  const dataStr = localStorage.getItem("cv_data");
  if (dataStr) {
    try {
      const data = JSON.parse(dataStr);
      setEditableData(data, editableAreas);
    } catch (e) {
      console.error("Error loading local data", e);
    }
  }
}

function exportJSON(editableAreas) {
  const data = getEditableData(editableAreas);
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cv-data.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importJSON(event, editableAreas) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      setEditableData(data, editableAreas);
      saveToLocal(editableAreas); // Sync to local
      alert("Data imported successfully!");
    } catch (error) {
      alert("Error importing file: " + error.message);
    }
  };
  reader.readAsText(file);
  event.target.value = ""; // Reset input
}

/* Cloud Sync (JSONBin) */

function setupCloudModal(editableAreas) {
  const modal = document.getElementById("cloud-modal");
  const span = document.getElementsByClassName("close")[0];
  const saveSettingsBtn = document.getElementById("save-settings-btn");
  const testBtn = document.getElementById("test-connection-btn");

  // Load saved settings
  const apiKeyInput = document.getElementById("api-key");
  const binIdInput = document.getElementById("bin-id");

  apiKeyInput.value = localStorage.getItem("jsonbin_api_key") || "";
  binIdInput.value = localStorage.getItem("jsonbin_bin_id") || "";

  span.onclick = function () {
    modal.style.display = "none";
  };

  window.onclick = function (event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  };

  saveSettingsBtn.onclick = async () => {
    const apiKey = apiKeyInput.value.trim();
    let binId = binIdInput.value.trim();

    if (!apiKey) {
      alert("API Key is required");
      return;
    }

    localStorage.setItem("jsonbin_api_key", apiKey);
    if (binId) localStorage.setItem("jsonbin_bin_id", binId);

    await saveToCloud(editableAreas, apiKey, binId, true);
    modal.style.display = "none";
  };

  testBtn.onclick = async () => {
    const apiKey = apiKeyInput.value.trim();
    const binId = binIdInput.value.trim();
    if (!apiKey) {
      alert("Enter API Key");
      return;
    }

    const statusDiv = document.getElementById("sync-status");
    statusDiv.textContent = "Testing connection...";
    statusDiv.className = "status-msg";

    try {
      if (binId) {
        await loadFromCloud(editableAreas, apiKey, binId, true);
        statusDiv.textContent = "Connection successful! Found existing bin.";
        statusDiv.className = "status-msg status-success";
      } else {
        statusDiv.textContent =
          "API Key looks good (cannot verify fully without Bin ID).";
        statusDiv.className = "status-msg status-success";
      }
    } catch (e) {
      statusDiv.textContent = "Error: " + e.message;
      statusDiv.className = "status-msg status-error";
    }
  };
}

function openCloudModal() {
  document.getElementById("cloud-modal").style.display = "block";
}

async function handleGlobalSave(editableAreas, isManual = false) {
  saveToLocal(editableAreas);

  const apiKey = localStorage.getItem("jsonbin_api_key");
  const binId = localStorage.getItem("jsonbin_bin_id");

  if (apiKey) {
    await saveToCloud(editableAreas, apiKey, binId, isManual);
  } else if (isManual) {
    alert("Changes saved locally!");
  }
}

async function saveToCloud(editableAreas, apiKey, binId, isManual = false) {
  const data = getEditableData(editableAreas);

  try {
    let url = "https://api.jsonbin.io/v3/b";
    let method = "POST";

    if (binId) {
      url = `https://api.jsonbin.io/v3/b/${binId}`;
      method = "PUT";
    }

    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": apiKey,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();

    if (!binId && result.metadata && result.metadata.id) {
      // New bin created
      binId = result.metadata.id;
      localStorage.setItem("jsonbin_bin_id", binId);
      document.getElementById("bin-id").value = binId;
      if (isManual) alert(`New Bin Created! ID: ${binId}`);
    } else if (isManual) {
      alert("Saved to Cloud Successfully!");
    }

    console.log("Saved to cloud", result);
  } catch (e) {
    console.error("Cloud save failed", e);
    if (isManual) alert("Cloud save failed: " + e.message);
  }
}

async function loadFromCloud(editableAreas, apiKey, binId, isTest = false) {
  try {
    const response = await fetch(
      `https://api.jsonbin.io/v3/b/${binId}/latest`,
      {
        headers: {
          "X-Master-Key": apiKey,
        },
      },
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    if (!isTest) {
      setEditableData(result.record, editableAreas);
      saveToLocal(editableAreas);
      alert("Data loaded from cloud!");
    }
    return result;
  } catch (e) {
    console.error("Cloud load failed", e);
    throw e;
  }
}
