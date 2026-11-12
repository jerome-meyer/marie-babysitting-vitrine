document.addEventListener("DOMContentLoaded", () => {
  const navToggle = document.querySelector(".nav-toggle");
  const mainNav = document.querySelector(".main-nav");

  if (navToggle && mainNav) {
    navToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  highlightCurrentPage();
  setupServiceForms();
  setupFeedbackPopover();
});

function highlightCurrentPage() {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".main-nav a").forEach((link) => {
    const linkPage = link.getAttribute("href");
    if (linkPage === currentPage) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });
}

function setupFeedbackPopover() {
  const popover = document.querySelector(".feedback-popover");

  if (!popover) {
    return;
  }

  const panel = popover.querySelector(".feedback-popover-panel");
  const closeButton = popover.querySelector(".feedback-close");
  const copyButton = popover.querySelector(".copy-feedback-email");
  const emailInput = popover.querySelector(".feedback-email");
  const copyStatus = popover.querySelector(".copy-status");
  let lastTrigger = null;

  const openPopover = (trigger) => {
    lastTrigger = trigger;
    popover.hidden = false;
    document.body.classList.add("has-open-popover");
    closeButton?.focus();
  };

  const closePopover = () => {
    popover.hidden = true;
    document.body.classList.remove("has-open-popover");
    setCopyStatus(copyStatus, "");
    lastTrigger?.focus();
  };

  document.querySelectorAll(".feedback-toggle").forEach((button) => {
    button.addEventListener("click", () => openPopover(button));
  });

  closeButton?.addEventListener("click", closePopover);

  popover.addEventListener("click", (event) => {
    if (event.target === popover) {
      closePopover();
    }
  });

  panel?.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !popover.hidden) {
      closePopover();
    }
  });

  copyButton?.addEventListener("click", async () => {
    if (!emailInput) {
      return;
    }

    try {
      await copyText(emailInput.value);
      setCopyStatus(copyStatus, "Adresse copiée.");
    } catch (error) {
      emailInput.select();
      setCopyStatus(copyStatus, "Copie automatique impossible. Vous pouvez sélectionner l'adresse manuellement.");
    }
  });
}

function setCopyStatus(copyStatus, message) {
  if (!copyStatus) {
    return;
  }

  copyStatus.textContent = message;
  copyStatus.hidden = !message;
}

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Copy failed");
  }
}

function setupServiceForms() {
  document.querySelectorAll(".service-form").forEach((form) => {
    const serviceSelect = form.querySelector("select[name='service']");
    const submitButton = form.querySelector("button[type='submit']");
    const honeypot = form.querySelector("input[name='_gotcha']");
    const statusMessage = getFormStatusMessage(form);
    setupScheduleRows(form);

    if (serviceSelect) {
      serviceSelect.addEventListener("change", () => {
        updateServiceDetails(form, serviceSelect.value);
      });
    }

    form.querySelectorAll("[data-custom-trigger]").forEach((select) => {
      select.addEventListener("change", () => updateCustomDetail(select));
    });

    updateServiceDetails(form, serviceSelect ? serviceSelect.value : "");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const action = form.getAttribute("action") || "";
      const selectValue = serviceSelect ? serviceSelect.value : "";

      setFormStatus(statusMessage, "", "");

      if (!form.reportValidity()) {
        return;
      }

      if (honeypot && honeypot.value) {
        return;
      }

      if (selectValue.toLowerCase().includes("autre")) {
        const confirmed = window.confirm(
          "Votre demande personnalisée sera étudiée par Marie, puis confirmée après discussion par message ou par e-mail. Voulez-vous l'envoyer maintenant ?"
        );

        if (!confirmed) {
          return;
        }
      }

      if (!action) {
        setFormStatus(statusMessage, "error", "Le formulaire n'a pas encore d'adresse d'envoi configurée.");
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Envoi en cours...";
      }

      try {
        const response = await fetch(action, {
          method: "POST",
          body: new FormData(form),
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(await getFormspreeErrorMessage(response));
        }

        let pdfDownloaded = true;

        try {
          await downloadRequestPdf(form);
        } catch (error) {
          pdfDownloaded = false;
          console.error(error);
        }

        form.reset();
        updateServiceDetails(form, "");
        setFormStatus(
          statusMessage,
          pdfDownloaded ? "success" : "warning",
          pdfDownloaded
            ? "Demande envoyée. Votre récapitulatif PDF a été téléchargé. Marie vous répondra par message ou par e-mail après étude de votre demande."
            : "Demande envoyée. Le PDF n'a pas pu être téléchargé automatiquement, mais Marie a bien reçu votre demande."
        );
      } catch (error) {
        setFormStatus(
          statusMessage,
          "error",
          error.message || "La demande n'a pas pu être envoyée. Réessayez dans quelques instants."
        );
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Envoyer la demande";
        }
      }
    });
  });
}

function setupScheduleRows(form) {
  const scheduleList = form.querySelector(".schedule-list");
  const addButton = form.querySelector(".add-schedule");

  if (!scheduleList || !addButton) {
    return;
  }

  addButton.addEventListener("click", () => {
    const firstRow = scheduleList.querySelector(".schedule-row");

    if (!firstRow) {
      return;
    }

    const newRow = firstRow.cloneNode(true);
    newRow.querySelectorAll("input").forEach((input) => {
      input.value = "";
    });
    scheduleList.appendChild(newRow);
    updateScheduleRemoveButtons(scheduleList);
    newRow.querySelector("input")?.focus();
  });

  scheduleList.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".remove-schedule");

    if (!removeButton) {
      return;
    }

    const rows = scheduleList.querySelectorAll(".schedule-row");

    if (rows.length <= 1) {
      return;
    }

    removeButton.closest(".schedule-row")?.remove();
    updateScheduleRemoveButtons(scheduleList);
  });

  updateScheduleRemoveButtons(scheduleList);
}

function updateScheduleRemoveButtons(scheduleList) {
  const rows = scheduleList.querySelectorAll(".schedule-row");

  rows.forEach((row) => {
    const removeButton = row.querySelector(".remove-schedule");

    if (removeButton) {
      removeButton.hidden = rows.length <= 1;
    }
  });
}

function updateServiceDetails(form, selectedService) {
  form.querySelectorAll(".service-details").forEach((panel) => {
    const isActive = panel.dataset.detailPanel === selectedService;
    panel.hidden = !isActive;
    panel.disabled = !isActive;

    if (!isActive) {
      panel.querySelectorAll("input, select, textarea").forEach((field) => {
        if (field.type === "checkbox" || field.type === "radio") {
          field.checked = false;
          return;
        }

        field.value = "";
      });
    }

    panel.querySelectorAll("select[data-custom-trigger]").forEach((select) => {
      select.required = isActive;
      if (!isActive) {
        select.selectedIndex = 0;
      }
      updateCustomDetail(select);
    });

    if (panel.dataset.detailPanel === "Autre / Demande personnalisée") {
      panel.querySelectorAll("textarea").forEach((textarea) => {
        textarea.disabled = !isActive;
        textarea.required = isActive;
      });
    }
  });
}

function updateCustomDetail(select) {
  const panel = select.closest(".service-details");
  const customDetail = panel ? panel.querySelector(".custom-detail") : null;
  const textarea = customDetail ? customDetail.querySelector("textarea") : null;
  const isCustom = select.value.toLowerCase().includes("autre");

  if (!customDetail || !textarea) {
    return;
  }

  customDetail.hidden = !isCustom;
  textarea.disabled = !isCustom || Boolean(panel?.disabled);
  textarea.required = isCustom && !panel?.disabled;

  if (!isCustom) {
    textarea.value = "";
  }
}

function getFormStatusMessage(form) {
  let statusMessage = form.querySelector(".form-status");

  if (!statusMessage) {
    statusMessage = document.createElement("p");
    statusMessage.className = "form-status";
    statusMessage.setAttribute("role", "status");
    statusMessage.setAttribute("aria-live", "polite");
    form.querySelector(".form-actions")?.before(statusMessage);
  }

  return statusMessage;
}

function setFormStatus(statusMessage, type, message) {
  if (!statusMessage) {
    return;
  }

  statusMessage.className = type ? `form-status form-status-${type}` : "form-status";
  statusMessage.textContent = message;
  statusMessage.hidden = !message;
}

async function getFormspreeErrorMessage(response) {
  try {
    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      return data.errors.map((error) => error.message).join(" ");
    }
  } catch (error) {
    return "La demande n'a pas pu être envoyée. Réessayez dans quelques instants.";
  }

  return "La demande n'a pas pu être envoyée. Réessayez dans quelques instants.";
}

async function downloadRequestPdf(form) {
  await loadJsPdf();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const data = getFormSummary(form);
  const fileName = createPdfFileName(data);
  const today = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  doc.setFillColor(26, 83, 186);
  doc.rect(0, 0, pageWidth, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Marie Services", margin, 18);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Récapitulatif de demande", margin, 28);

  y = 52;
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(data.service || "Demande de prestation", margin, y);
  y += 9;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Document généré le ${today}`, margin, y);
  y += 14;

  const rows = [
    ["Nom", data.nom],
    ["Prénom", data.prenom],
    ["Email", data.email],
    ["Téléphone", data.telephone],
    ["Prestation", data.prestation],
    ...data.fields,
  ];

  rows.forEach(([label, value]) => {
    y = addPdfField(doc, {
      label,
      value,
      x: margin,
      y,
      width: contentWidth,
      pageHeight,
      margin,
    });
  });

  y += 4;
  y = ensurePdfSpace(doc, y, 40, pageHeight, margin);
  doc.setFillColor(255, 247, 251);
  doc.setDrawColor(236, 72, 153);
  doc.roundedRect(margin, y, contentWidth, 34, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(131, 24, 67);
  doc.text("Note importante", margin + 5, y + 8);
  doc.setFont("helvetica", "normal");
  doc.text(
    doc.splitTextToSize(
      "Cette demande ne vaut pas validation automatique. Marie l'étudiera puis confirmera la prestation après discussion par message ou par e-mail.",
      contentWidth - 10
    ),
    margin + 5,
    y + 15
  );

  doc.save(fileName);
}

function getFormSummary(form) {
  const formData = new FormData(form);
  const service = formData.get("service") || "";
  const preciseService = getFirstFormValue(formData, [
    "prestation_babysitting",
    "prestation_animaux",
    "prestation_seniors",
  ]);
  const prestation = preciseService ? `${service} - ${preciseService}` : service;

  return {
    service: prestation || form.dataset.service || "",
    nom: formData.get("nom") || "",
    prenom: formData.get("prenom") || "",
    email: formData.get("email") || "",
    telephone: formData.get("telephone") || "",
    prestation,
    fields: getPdfFields(formData),
  };
}

function getFirstFormValue(formData, names) {
  for (const name of names) {
    const value = formData.get(name);

    if (value) {
      return value;
    }
  }

  return "";
}

function getPdfFields(formData) {
  const labels = {
    creneaux: "Créneaux souhaités",
    frequence: "Fréquence",
    secteur: "Secteur / lieu général",
    nombre_enfants: "Nombre d'enfants",
    ages_enfants: "Âge(s) des enfants",
    consignes_enfants: "Allergies, santé ou consignes enfants",
    details_babysitting: "Demande particulière baby-sitting",
    animal_concerne: "Animal concerné",
    nombre_animaux: "Nombre d'animaux",
    taille_temperament_chien: "Taille / tempérament du chien",
    habitudes_animal: "Habitudes importantes",
    consignes_animaux: "Allergies, santé ou consignes animal",
    details_animaux: "Demande particulière animaux",
    personne_concernee: "Personne concernée",
    mobilite: "Mobilité / déplacement",
    consignes_seniors: "Habitudes, allergies ou points de vigilance",
    details_seniors: "Demande particulière accompagnement",
    details_personnalises: "Demande personnalisée",
  };
  const ignoredNames = new Set([
    "_subject",
    "_gotcha",
    "consentement",
    "service",
    "creneau_date[]",
    "creneau_debut[]",
    "creneau_fin[]",
    "creneau_note[]",
    "prestation_babysitting",
    "prestation_animaux",
    "prestation_seniors",
    "nom",
    "prenom",
    "email",
    "telephone",
  ]);
  const fields = [];
  const scheduleSummary = getScheduleSummary(formData);

  if (scheduleSummary) {
    fields.push([labels.creneaux, scheduleSummary]);
  }

  formData.forEach((value, name) => {
    const safeValue = String(value || "").trim();

    if (ignoredNames.has(name) || !safeValue || !labels[name]) {
      return;
    }

    fields.push([labels[name], safeValue]);
  });

  return fields;
}

function getScheduleSummary(formData) {
  const dates = formData.getAll("creneau_date[]");
  const starts = formData.getAll("creneau_debut[]");
  const ends = formData.getAll("creneau_fin[]");
  const notes = formData.getAll("creneau_note[]");

  return dates
    .map((date, index) => {
      const start = starts[index] || "";
      const end = ends[index] || "";
      const note = notes[index] || "";
      const dateLabel = formatFrenchDate(date);
      const timeLabel = start && end ? `${start} - ${end}` : start || end;

      return [dateLabel, timeLabel, note].filter(Boolean).join(" | ");
    })
    .filter(Boolean)
    .join("\n");
}

function formatFrenchDate(value) {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function addPdfField(doc, options) {
  const { label, value, x, y, width, pageHeight, margin } = options;
  const safeValue = String(value || "Non renseigné");
  const lines = doc.splitTextToSize(safeValue, width);
  const boxHeight = Math.max(18, 10 + lines.length * 5);
  const nextY = ensurePdfSpace(doc, y, boxHeight + 5, pageHeight, margin);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(26, 83, 186);
  doc.text(label, x, nextY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(lines, x, nextY + 7);

  doc.setDrawColor(219, 228, 240);
  doc.line(x, nextY + boxHeight, x + width, nextY + boxHeight);

  return nextY + boxHeight + 6;
}

function ensurePdfSpace(doc, y, neededHeight, pageHeight, margin) {
  if (y + neededHeight <= pageHeight - margin) {
    return y;
  }

  doc.addPage();
  return margin;
}

function createPdfFileName(data) {
  const service = slugify(data.service || "demande");
  const name = slugify(`${data.prenom || ""}-${data.nom || ""}`) || "client";
  const date = new Date().toISOString().slice(0, 10);

  return `recap-${service}-${name}-${date}.pdf`;
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function loadJsPdf() {
  if (window.jspdf && window.jspdf.jsPDF) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector("script[data-jspdf]");

    if (existingScript) {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
    script.defer = true;
    script.dataset.jspdf = "true";
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.appendChild(script);
  });
}
