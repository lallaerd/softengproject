
export function createFlashcard(question, answer, hint, tags, priority) {
  if (!question.trim() || !answer.trim()) {
    throw new Error("Question and answer are required.");
  }

  if (!["High", "Medium", "Low"].includes(priority)) {
    throw new Error("Invalid priority.");
  }

  return {
    id: Date.now() + Math.random(),
    question: question.trim(),
    answer: answer.trim(),
    hint: hint.trim(),
    tags: tags.split(",").map(tag => tag.trim()).filter(Boolean),
    priority
  };
}
export function filterFlashcards(cards, query, priority) {
  const searchText = query.trim().toLowerCase();

  return cards.filter(card => {
    const matchesQuery =
      card.question.toLowerCase().includes(searchText) ||
      card.answer.toLowerCase().includes(searchText) ||
      card.tags.some(tag =>
        tag.toLowerCase().includes(searchText)
      );

    const matchesPriority =
      priority === "All" || card.priority === priority;

    return matchesQuery && matchesPriority;
  });
}