let currentProject = null;
let currentPlan = null;
let currentFinalContent = null;


/* =========================================================
   THEME
========================================================= */

function applyTheme(theme) {

  document.documentElement.setAttribute(
    "data-theme",
    theme
  );

  localStorage.setItem(
    "ezerv-theme",
    theme
  );

  const btn =
    document.getElementById("themeBtn");

  if (btn) {

    btn.textContent =
      theme === "dark"
        ? "☀️ Light"
        : "🌙 Dark";

  }
}


function toggleTheme() {

  const current =
    document.documentElement.getAttribute(
      "data-theme"
    ) || "dark";

  applyTheme(
    current === "dark"
      ? "light"
      : "dark"
  );
}


(function initialiseTheme() {

  const saved =
    localStorage.getItem(
      "ezerv-theme"
    );

  applyTheme(
    saved || "dark"
  );

})();


/* =========================================================
   MODE
========================================================= */

document
  .querySelectorAll(
    'input[name="mode"]'
  )
  .forEach(radio => {

    radio.addEventListener(
      "change",
      updateModeUI
    );

  });


function updateModeUI() {

  const mode =
    document.querySelector(
      'input[name="mode"]:checked'
    ).value;

  const manual =
    document.getElementById(
      "manualTopicContainer"
    );

  const automatic =
    document.getElementById(
      "automaticTopicInfo"
    );

  if (mode === "automatic") {

    manual.classList.add(
      "hidden"
    );

    automatic.classList.remove(
      "hidden"
    );

  } else {

    manual.classList.remove(
      "hidden"
    );

    automatic.classList.add(
      "hidden"
    );

  }

}


updateModeUI();


/* =========================================================
   STATUS
========================================================= */

function setStatus(
  message,
  error = false
) {

  const status =
    document.getElementById(
      "status"
    );

  status.innerHTML =
    error
      ? `<div class="error">❌ ${escapeHtml(message)}</div>`
      : `<div class="badge">${message}</div>`;
}


function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


/* =========================================================
   API RESPONSE HELPER
========================================================= */

async function readApiResponse(response) {
  const text = await response.text();

  if (!text) {
    throw new Error(
      `Server returned ${response.status} with an empty response.`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    const cleanText = text
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    throw new Error(
      `Server error (${response.status}): ${cleanText.slice(0, 300)}`
    );
  }
}


/* =========================================================
   GENERATE PLAN
========================================================= */

async function generatePlan() {

  const mode =
    document.querySelector(
      'input[name="mode"]:checked'
    ).value;

  const topic =
    document.getElementById(
      "topic"
    ).value.trim();

  const tone =
    document.getElementById(
      "tone"
    ).value;

  const pages =
    Number(
      document.getElementById(
        "pageCount"
      ).value
    );

  const btn =
    document.getElementById(
      "generateBtn"
    );


  if (
    mode === "manual" &&
    !topic
  ) {

    alert(
      "Please enter a topic for manual mode."
    );

    return;

  }


  resetFinalState();


  btn.disabled = true;


  btn.textContent =
    mode === "automatic"
      ? "🔎 Researching Current Topics..."
      : "🧠 Creating Content Plan...";


  setStatus(
    mode === "automatic"
      ? "🌐 Researching current developments and selecting a topic..."
      : "🧠 Building your content architecture..."
  );


  try {

    const response =
      await fetch(
        "/api/generate",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            action: "plan",

            mode,

            topic,

            tone,

            pages

          })

        }
      );


    const data =
      await readApiResponse(response);


    if (
      !response.ok ||
      data.error
    ) {

      throw new Error(
        data.error ||
        "Unable to create content plan."
      );

    }


    currentProject =
      data;

    currentPlan =
      data.plan;


    /* TOPIC */

    const topicPreview =
      document.getElementById(
        "topicPreview"
      );


    topicPreview.innerHTML = `

      <strong>
        ${mode === "automatic"
          ? "🤖 AI Selected Topic"
          : "✍️ User Selected Topic"}
      </strong>

      <div
        style="
          margin-top:8px;
          font-size:1.15rem;
          font-weight:600;
        "
      >
        ${escapeHtml(
          data.topicUsed
        )}
      </div>

      ${
        data.topicReason
          ? `
            <p style="color:var(--muted);">
              ${escapeHtml(
                data.topicReason
              )}
            </p>
          `
          : ""
      }

    `;


    topicPreview.classList.remove(
      "hidden"
    );


    renderPlan(
      data.plan
    );


    setStatus(
      "✅ Plan generated. Review it and choose Proceed or Cancel."
    );


  } catch (error) {

    setStatus(
      error.message,
      true
    );

  } finally {

    btn.disabled = false;

    btn.textContent =
      "🧠 Generate Content Plan";

  }

}


/* =========================================================
   RENDER PLAN
========================================================= */

function renderPlan(plan) {

  const box =
    document.getElementById(
      "planBox"
    );

  const content =
    document.getElementById(
      "planContent"
    );

  const pages =
    document.getElementById(
      "planPages"
    );

  const visualPlan =
    document.getElementById(
      "visualPlan"
    );


  pages.textContent =
    `${plan.pageCount || ""} Pages`;


  const sections =
    Array.isArray(
      plan.sections
    )
      ? plan.sections
      : [];


  content.innerHTML =
    sections
      .map(
        section => `

          <div class="plan-section">

            <h3>
              ${escapeHtml(
                section.title ||
                "Section"
              )}
            </h3>

            <p>
              ${escapeHtml(
                section.purpose ||
                ""
              )}
            </p>

            ${
              Array.isArray(
                section.keyPoints
              )
                ? `
                  <ul>

                    ${section.keyPoints
                      .map(
                        point =>
                          `<li>
                            ${escapeHtml(point)}
                          </li>`
                      )
                      .join("")}

                  </ul>
                `
                : ""
            }

          </div>

        `
      )
      .join("");


  const visuals =
    Array.isArray(
      plan.visuals
    )
      ? plan.visuals
      : [];


  if (visuals.length) {

    visualPlan.innerHTML = `

      <h3>
        🎨 Planned Visuals
      </h3>

      ${visuals
        .map(
          visual => `

            <div class="visual-card">

              <div class="visual-type">
                ${escapeHtml(
                  visual.type ||
                  "Visual"
                )}
              </div>

              <div style="margin-top:6px;">
                ${escapeHtml(
                  visual.description ||
                  ""
                )}
              </div>

            </div>

          `
        )
        .join("")}

    `;

  } else {

    visualPlan.innerHTML = "";

  }


  box.classList.remove(
    "hidden"
  );


  box.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

}


/* =========================================================
   PROCEED
========================================================= */

async function proceedToGeneration() {

  if (
    !currentProject ||
    !currentPlan
  ) {

    return;

  }


  const proceedBtn =
    document.getElementById(
      "proceedBtn"
    );

  const cancelBtn =
    document.getElementById(
      "cancelBtn"
    );


  proceedBtn.disabled = true;
  cancelBtn.disabled = true;


  setStatus(
    "⚙️ Generating final content..."
  );


  try {

    const response =
      await fetch(
        "/api/generate",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            action: "generate",

            topic:
              currentProject.topicUsed,

            tone:
              currentProject.tone,

            pages:
              currentProject.pages,

            plan:
              currentPlan

          })

        }
      );


    const data =
      await readApiResponse(response);


    if (
      !response.ok ||
      data.error
    ) {

      throw new Error(
        data.error ||
        "Content generation failed."
      );

    }


    currentFinalContent =
      data.finalPost;


    const output =
      document.getElementById(
        "output"
      );


    output.innerHTML =
      marked.parse(
        data.finalPost
      );


    output.classList.remove(
      "hidden"
    );


    document
      .getElementById(
        "planBox"
      )
      .classList.add(
        "hidden"
      );


    /*
     * DOWNLOAD BUTTON APPEARS
     * ONLY AFTER FINAL CONTENT EXISTS.
     */

    document
      .getElementById(
        "downloadWrapper"
      )
      .style.display =
        "block";


    setStatus(
      `🎉 Content generated successfully. ${data.generationCalls} content generation call(s) used.`
    );


    output.scrollIntoView({
      behavior: "smooth"
    });


  } catch (error) {

    setStatus(
      error.message,
      true
    );

  } finally {

    proceedBtn.disabled = false;
    cancelBtn.disabled = false;

  }

}


/* =========================================================
   CANCEL
========================================================= */

function cancelPlan() {

  currentProject = null;
  currentPlan = null;
  currentFinalContent = null;


  document
    .getElementById(
      "planBox"
    )
    .classList.add(
      "hidden"
    );


  document
    .getElementById(
      "topicPreview"
    )
    .classList.add(
      "hidden"
    );


  document
    .getElementById(
      "output"
    )
    .classList.add(
      "hidden"
    );


  document
    .getElementById(
      "downloadWrapper"
    )
    .style.display =
      "none";


  setStatus(
    "↻ Cancelled. You can generate a new topic and content plan."
  );

}


/* =========================================================
   RESET
========================================================= */

function resetFinalState() {

  currentProject = null;
  currentPlan = null;
  currentFinalContent = null;


  document
    .getElementById(
      "planBox"
    )
    .classList.add(
      "hidden"
    );


  document
    .getElementById(
      "topicPreview"
    )
    .classList.add(
      "hidden"
    );


  document
    .getElementById(
      "output"
    )
    .classList.add(
      "hidden"
    );


  document
    .getElementById(
      "downloadWrapper"
    )
    .style.display =
      "none";

}


/* =========================================================
   DOWNLOAD MENU
========================================================= */

function toggleDownloadMenu() {

  document
    .getElementById(
      "downloadMenu"
    )
    .classList.toggle(
      "hidden"
    );

}


/* =========================================================
   DOWNLOAD
========================================================= */

async function downloadFormat(
  format
) {

  if (!currentFinalContent) {

    alert(
      "Generate final content first."
    );

    return;

  }


  document
    .getElementById(
      "downloadMenu"
    )
    .classList.add(
      "hidden"
    );


  try {

    setStatus(
      `📦 Preparing ${format.toUpperCase()} download...`
    );


    const response =
      await fetch(
        "/api/export",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            format,

            topic:
              currentProject.topicUsed,

            content:
              currentFinalContent

          })

        }
      );


    if (!response.ok) {

      const data =
        await response
          .json()
          .catch(
            () => ({})
          );


      throw new Error(
        data.error ||
        "Download failed."
      );

    }


    const blob =
      await response.blob();


    const url =
      URL.createObjectURL(
        blob
      );


    const anchor =
      document.createElement(
        "a"
      );


    anchor.href = url;


    const disposition =
      response.headers.get(
        "Content-Disposition"
      );


    let filename =
      `EZERV-Forge-${slugify(
        currentProject.topicUsed
      )}`;


    if (
      disposition &&
      disposition.includes(
        "filename="
      )
    ) {

      filename =
        disposition
          .split(
            "filename="
          )[1]
          .replace(
            /"/g,
            ""
          );

    }


    anchor.download =
      filename;


    document.body.appendChild(
      anchor
    );


    anchor.click();


    anchor.remove();


    URL.revokeObjectURL(
      url
    );


    setStatus(
      "✅ Download prepared successfully."
    );


  } catch (error) {

    setStatus(
      error.message,
      true
    );

  }

}


/* =========================================================
   SLUG
========================================================= */

function slugify(text) {

  return String(text || "")

    .toLowerCase()

    .replace(
      /[^a-z0-9]+/g,
      "-"
    )

    .replace(
      /^-+|-+$/g,
      ""
    )

    .substring(
      0,
      80
    );

}