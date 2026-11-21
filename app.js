import { createFlashcard } from "./flashcard.js";
const cards = JSON.parse(localStorage.getItem("flashcards") || "[]");

const form = document.getElementById("flashcardForm");
const list = document.getElementById("flashcardList");
const studyArea = document.getElementById("studyArea");
const search = document.getElementById("search");
const priorityFilter = document.getElementById("priorityFilter");
const message = document.getElementById("formMessage");

function updateStats() {
  document.getElementById("totalCards").textContent = cards.length;
  document.getElementById("highPriority").textContent =
    cards.filter(card => card.priority === "High").length;

  const tags = new Set(cards.flatMap(card => card.tags));
  document.getElementById("totalSubjects").textContent = tags.size;
}

export function renderCards() {
  list.replaceChildren();

  const query = search.value.trim().toLowerCase();
  const priority = priorityFilter.value;

  const filtered = cards.filter(card => {
    const matchesQuery =
      card.question.toLowerCase().includes(query) ||
      card.answer.toLowerCase().includes(query) ||
      card.tags.some(tag => tag.toLowerCase().includes(query));

    const matchesPriority =
      priority === "All" || card.priority === priority;

    return matchesQuery && matchesPriority;
  });

  if (filtered.length === 0) {
    list.textContent = "No flashcards found.";
    return;
  }

  filtered.forEach(card => {
    const item = document.createElement("article");
    item.className = "flashcard";

    const title = document.createElement("h3");
    title.textContent = card.question;

    const answer = document.createElement("p");
    answer.textContent = `Answer: ${card.answer}`;

    const tags = document.createElement("p");
    tags.textContent = `Tags: ${card.tags.join(", ") || "None"}`;

    const priority = document.createElement("p");
    priority.textContent = `Priority: ${card.priority}`;

    item.append(title, answer, tags, priority);
    list.appendChild(item);
  });
}

function renderStudyMode() {
  studyArea.replaceChildren();

  if (cards.length === 0) {
    studyArea.textContent = "Create a flashcard to start studying.";
    return;
  }

  const card = cards[0];
  const container = document.createElement("div");
  container.className = "flashcard";

  const question = document.createElement("h3");
  question.textContent = card.question;

  const answer = document.createElement("p");
  answer.textContent = card.answer;
  answer.hidden = true;

  const button = document.createElement("button");
  button.textContent = "Reveal Answer";
  button.addEventListener("click", () => {
    answer.hidden = !answer.hidden;
    button.textContent = answer.hidden ? "Reveal Answer" : "Hide Answer";
  });

  container.append(question, answer, button);
  studyArea.appendChild(container);
}

form.addEventListener("submit", event => {
  event.preventDefault();

  try {
    const card = createFlashcard(
      document.getElementById("question").value,
      document.getElementById("answer").value,
      document.getElementById("hint").value,
      document.getElementById("tags").value,
      document.getElementById("priority").value
    );

    cards.push(card);
    localStorage.setItem("flashcards", JSON.stringify(cards));
    form.reset();
    message.style.color = "#16a34a";
    message.textContent = "Flashcard created successfully!";

    updateStats();
    renderCards();
    renderStudyMode();
  } catch (error) {
    message.style.color = "#dc2626";
    message.textContent = error.message;
  }
});

search.addEventListener("input", renderCards);
priorityFilter.addEventListener("change", renderCards);

updateStats();
renderCards();
renderStudyMode();
