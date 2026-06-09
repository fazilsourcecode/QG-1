
export type MarksheetType = "cat-3-credits" | "cat-2-credits" | "sem-3-credits" | "sem-2-credits"

export type QuestionGroupType = Record<string, string[]>
export type MaxMarksType = Record<string, number>

export interface MarksheetConfig {
  type: MarksheetType
  name: string
  questionGroups: QuestionGroupType
  maxMarks: MaxMarksType
  structure: {
    partA: string[]
    partB: { question: string; options: string[] }[]
    partC?: { question: string; options: string[] }[]
  }
}

const cat3CreditsConfig: MarksheetConfig = {
  type: "cat-3-credits",
  name: "CAT (3 Credits)",
  questionGroups: {
    PartA: ["1", "2", "3", "4", "5", "6"],
    "6A": ["6a(i)", "6a(ii)", "6a(iii)"],
    "6B": ["6b(i)", "6b(ii)", "6b(iii)"],
    "7A": ["7a(i)", "7a(ii)", "7a(iii)"],
    "7B": ["7b(i)", "7b(ii)", "7b(iii)"],
    "8A": ["8a(i)", "8a(ii)", "8a(iii)"],
    "8B": ["8b(i)", "8b(ii)", "8b(iii)"],
  },
  maxMarks: {
    "1": 2, "2": 2, "3": 2, "4": 2, "5": 2, "6": 2,
    "6a(i)": 16, "6a(ii)": 16, "6a(iii)": 16,
    "6b(i)": 16, "6b(ii)": 16, "6b(iii)": 16,
    "7a(i)": 16, "7a(ii)": 16, "7a(iii)": 16,
    "7b(i)": 16, "7b(ii)": 16, "7b(iii)": 16,
    "8a(i)": 8, "8a(ii)": 8, "8a(iii)": 8,
    "8b(i)": 8, "8b(ii)": 8, "8b(iii)": 8,
  },
  structure: {
    partA: ["1", "2", "3", "4", "5", "6"],
    partB: [
      { question: "6", options: ["a", "b"] },
      { question: "7", options: ["a", "b"] },
    ],
    partC: [{ question: "8", options: ["a", "b"] }],
  },
}

const cat2CreditsConfig: MarksheetConfig = {
  type: "cat-2-credits",
  name: "CAT (2 Credits)",
  questionGroups: {
    PartA: ["1", "2", "3", "4", "5", "6"],
    "6A": ["6a(i)", "6a(ii)", "6a(iii)"],
    "6B": ["6b(i)", "6b(ii)", "6b(iii)"],
    "7A": ["7a(i)", "7a(ii)", "7a(iii)"],
    "7B": ["7b(i)", "7b(ii)", "7b(iii)"],
  },
  maxMarks: {
    "1": 2, "2": 2, "3": 2, "4": 2, "5": 2, "6": 2,
    "6a(i)": 20, "6a(ii)": 20, "6a(iii)": 20,
    "6b(i)": 20, "6b(ii)": 20, "6b(iii)": 20,
    "7a(i)": 20, "7a(ii)": 20, "7a(iii)": 20,
    "7b(i)": 20, "7b(ii)": 20, "7b(iii)": 20,
  },
  structure: {
    partA: ["1", "2", "3", "4", "5", "6"],
    partB: [
      { question: "6", options: ["a", "b"] },
      { question: "7", options: ["a", "b"] },
    ],
  },
}

const sem3CreditsConfig: MarksheetConfig = {
  type: "sem-3-credits",
  name: "SEM (3 Credits)",
  questionGroups: {
    PartA: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    "11A": ["11a(i)", "11a(ii)", "11a(iii)"], "11B": ["11b(i)", "11b(ii)", "11b(iii)"],
    "12A": ["12a(i)", "12a(ii)", "12a(iii)"], "12B": ["12b(i)", "12b(ii)", "12b(iii)"],
    "13A": ["13a(i)", "13a(ii)", "13a(iii)"], "13B": ["13b(i)", "13b(ii)", "13b(iii)"],
    "14A": ["14a(i)", "14a(ii)", "14a(iii)"], "14B": ["14b(i)", "14b(ii)", "14b(iii)"],
    "15A": ["15a(i)", "15a(ii)", "15a(iii)"], "15B": ["15b(i)", "15b(ii)", "15b(iii)"],
  },
  maxMarks: {
    "1": 2, "2": 2, "3": 2, "4": 2, "5": 2, "6": 2, "7": 2, "8": 2, "9": 2, "10": 2,
    "11a(i)": 16, "11a(ii)": 16, "11a(iii)": 16, "11b(i)": 16, "11b(ii)": 16, "11b(iii)": 16,
    "12a(i)": 16, "12a(ii)": 16, "12a(iii)": 16, "12b(i)": 16, "12b(ii)": 16, "12b(iii)": 16,
    "13a(i)": 16, "13a(ii)": 16, "13a(iii)": 16, "13b(i)": 16, "13b(ii)": 16, "13b(iii)": 16,
    "14a(i)": 16, "14a(ii)": 16, "14a(iii)": 16, "14b(i)": 16, "14b(ii)": 16, "14b(iii)": 16,
    "15a(i)": 16, "15a(ii)": 16, "15a(iii)": 16, "15b(i)": 16, "15b(ii)": 16, "15b(iii)": 16,
  },
  structure: {
    partA: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    partB: [
      { question: "11", options: ["a", "b"] },
      { question: "12", options: ["a", "b"] },
      { question: "13", options: ["a", "b"] },
      { question: "14", options: ["a", "b"] },
    ],
    partC: [{ question: "15", options: ["a", "b"] }],
  },
}

const sem2CreditsConfig: MarksheetConfig = {
  type: "sem-2-credits",
  name: "SEM (2 Credits)",
  questionGroups: {
    PartA: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    "11A": ["11a(i)", "11a(ii)", "11a(iii)"], "11B": ["11b(i)", "11b(ii)", "11b(iii)"],
    "12A": ["12a(i)", "12a(ii)", "12a(iii)"], "12B": ["12b(i)", "12b(ii)", "12b(iii)"],
    "13A": ["13a(i)", "13a(ii)", "13a(iii)"], "13B": ["13b(i)", "13b(ii)", "13b(iii)"],
    "14A": ["14a(i)", "14a(ii)", "14a(iii)"], "14B": ["14b(i)", "14b(ii)", "14b(iii)"],
  },
  maxMarks: {
    "1": 2, "2": 2, "3": 2, "4": 2, "5": 2, "6": 2, "7": 2, "8": 2, "9": 2, "10": 2,
    "11a(i)": 20, "11a(ii)": 20, "11a(iii)": 20, "11b(i)": 20, "11b(ii)": 20, "11b(iii)": 20,
    "12a(i)": 20, "12a(ii)": 20, "12a(iii)": 20, "12b(i)": 20, "12b(ii)": 20, "12b(iii)": 20,
    "13a(i)": 20, "13a(ii)": 20, "13a(iii)": 20, "13b(i)": 20, "13b(ii)": 20, "13b(iii)": 20,
    "14a(i)": 20, "14a(ii)": 20, "14a(iii)": 20, "14b(i)": 20, "14b(ii)": 20, "14b(iii)": 20,
  },
  structure: {
    partA: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    partB: [
        { question: "11", options: ["a", "b"] },
        { question: "12", options: ["a", "b"] },
        { question: "13", options: ["a", "b"] },
        { question: "14", options: ["a", "b"] },
    ],
  },
};

const marksheetConfigs: Record<MarksheetType, MarksheetConfig> = {
  "cat-3-credits": cat3CreditsConfig,
  "cat-2-credits": cat2CreditsConfig,
  "sem-3-credits": sem3CreditsConfig,
  "sem-2-credits": sem2CreditsConfig,
}

export function getMarksheetConfig(type: MarksheetType): MarksheetConfig | null {
  return marksheetConfigs[type] || null
}
