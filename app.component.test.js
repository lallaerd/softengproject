// @vitest-environment jsdom

import { describe, it, expect, vi } from "vitest";

describe("FlashFocus App Component", () => {
  it("should display a flashcard using renderCards", async () => {
    document.body.innerHTML = `
      <form id="flashcardForm"></form>
      <div id="flashcardList"></div>
      <div id="studyArea"></div>
      <input id="search" value="" />
      <select id="priorityFilter">
        <option value="All">All</option>
      </select>
      <div id="formMessage"></div>
      <span id="totalCards"></span>
      <span id="highPriority"></span>
      <span id="totalSubjects"></span>
    `;

    const card = {
      question: "What is Python?",
      answer: "Python is a programming language.",
      tags: ["Programming"],
      priority: "High"
    };

    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => JSON.stringify([card])),
      setItem: vi.fn()
    });

    vi.resetModules();

    const { renderCards } = await import("./app.js");
    renderCards();

    const list = document.getElementById("flashcardList");

    expect(list.textContent).toContain("What is Python?");
    expect(list.textContent).toContain("Python is a programming language.");
    expect(list.textContent).toContain("Programming");
    expect(list.textContent).toContain("High");
  });
});