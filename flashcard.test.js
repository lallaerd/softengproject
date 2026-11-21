import { describe, it, expect } from "vitest";
import { createFlashcard, filterFlashcards } from "./flashcard.js";
describe("Flashcard Validation", () => {
  it("should reject an empty question", () => {
    expect(() =>
      createFlashcard("", "Test answer", "", "", "High")
    ).toThrow("Question and answer are required.");
  });

  it("should accept a valid question and answer", () => {
    const card = createFlashcard(
      "What is Python?",
      "Python is a programming language.",
      "",
      "Programming",
      "High"
    );

    expect(card.question).toBe("What is Python?");
    expect(card.answer).toBe("Python is a programming language.");
    expect(card.priority).toBe("High");
  });
  it("should reject an invalid priority", () => {
  expect(() =>
    createFlashcard(
      "What is HTML?",
      "HTML structures web pages.",
      "",
      "Web",
      "Very High"
    )
  ).toThrow("Invalid priority.");
});
});
describe("Flashcard Search", () => {
  it("should find flashcards by question", () => {
    const cards = [
      {
        question: "What is Python?",
        answer: "A programming language",
        tags: ["Programming"],
        priority: "High"
      },
      {
        question: "What is HTML?",
        answer: "A markup language",
        tags: ["Web"],
        priority: "Low"
      }
    ];

    const results = filterFlashcards(cards, "Python", "All");

    expect(results).toHaveLength(1);
    expect(results[0].question).toBe("What is Python?");
  });
});
describe("Flashcard Priority Filter", () => {
  it("should show only high priority flashcards", () => {
    const cards = [
      {
        question: "What is Python?",
        answer: "A programming language",
        tags: ["Programming"],
        priority: "High"
      },
      {
        question: "What is HTML?",
        answer: "A markup language",
        tags: ["Web"],
        priority: "Low"
      }
    ];

    const results = filterFlashcards(cards, "", "High");

    expect(results).toHaveLength(1);
    expect(results[0].priority).toBe("High");
  });
});
describe("Flashcard Tag Search", () => {
  it("should find flashcards by tag", () => {
    const cards = [
      {
        question: "What is Python?",
        answer: "A programming language",
        tags: ["Programming"],
        priority: "High"
      },
      {
        question: "What is HTML?",
        answer: "A markup language",
        tags: ["Web"],
        priority: "Low"
      }
    ];

    const results = filterFlashcards(
      cards,
      "Programming",
      "All"
    );

    expect(results).toHaveLength(1);
    expect(results[0].question).toBe("What is Python?");
  });
});
describe("Flashcard Search - No Results", () => {
  it("should return an empty list when no cards match", () => {
    const cards = [
      {
        question: "What is Python?",
        answer: "A programming language",
        tags: ["Programming"],
        priority: "High"
      }
    ];

    const results = filterFlashcards(cards, "Biology", "All");

    expect(results).toHaveLength(0);
  });
});
describe("Case-Insensitive Search", () => {
  it("should find flashcards regardless of uppercase or lowercase", () => {
    const cards = [
      {
        question: "What is Python?",
        answer: "A programming language",
        tags: ["Programming"],
        priority: "High"
      }
    ];

    const results = filterFlashcards(cards, "PYTHON", "All");

    expect(results).toHaveLength(1);
    expect(results[0].question).toBe("What is Python?");
  });
});
describe("Combined Search and Priority Filter", () => {
  it("should return only matching high priority cards", () => {
    const cards = [
      {
        question: "What is Python?",
        answer: "A programming language",
        tags: ["Programming"],
        priority: "High"
      },
      {
        question: "What is Java?",
        answer: "A programming language",
        tags: ["Programming"],
        priority: "Low"
      },
      {
        question: "What is HTML?",
        answer: "A markup language",
        tags: ["Web"],
        priority: "High"
      }
    ];

    const results = filterFlashcards(
      cards,
      "Programming",
      "High"
    );

    expect(results).toHaveLength(1);
    expect(results[0].question).toBe("What is Python?");
  });
});
describe("Empty Flashcard Collection", () => {
  it("should return no results when there are no flashcards", () => {
    const cards = [];

    const results = filterFlashcards(
      cards,
      "Python",
      "All"
    );

    expect(results).toHaveLength(0);
  });
});