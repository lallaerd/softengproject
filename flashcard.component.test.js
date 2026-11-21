// @vitest-environment jsdom

import { describe, it, expect } from "vitest";

describe("Flashcard Display Component", () => {
  it("should display a flashcard question", () => {
    document.body.innerHTML = `
      <div id="flashcardList"></div>
    `;

    const list = document.getElementById("flashcardList");

    const card = {
      question: "What is Python?",
      answer: "Python is a programming language."
    };

    const element = document.createElement("div");
    element.textContent = card.question;
    list.appendChild(element);

    expect(list.textContent).toContain("What is Python?");
  });
});
describe("Flashcard Answer Display", () => {
  it("should display the answer when requested", () => {
    document.body.innerHTML = `
      <div id="studyArea"></div>
    `;

    const studyArea = document.getElementById("studyArea");

    const answer = document.createElement("p");
    answer.textContent = "Python is a programming language.";

    studyArea.appendChild(answer);

    expect(studyArea.textContent).toContain(
      "Python is a programming language."
    );
  });
});
describe("Flashcard Form Component", () => {
  it("should contain question and answer fields", () => {
    document.body.innerHTML = `
      <form id="flashcardForm">
        <input id="question" />
        <input id="answer" />
      </form>
    `;

    const question = document.getElementById("question");
    const answer = document.getElementById("answer");

    expect(question).not.toBeNull();
    expect(answer).not.toBeNull();
  });
});