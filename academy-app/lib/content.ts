import grammars from '../content/grammars.json';
import words from '../content/words.json';
import questions from '../content/questions.json';
import type { Grammar, Word, Question } from './types';
export const GRAMMARS = grammars as Grammar[];
export const WORDS = words as Word[];
export const QUESTIONS = questions as Question[];
