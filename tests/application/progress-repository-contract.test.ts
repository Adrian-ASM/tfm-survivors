import {
  InMemoryProgressRepository,
  type ProgressCell,
} from '../support/InMemoryProgressRepository';
import { describeProgressRepositoryContract } from '../support/progressRepositoryContract';

describeProgressRepositoryContract('InMemoryProgressRepository (fake)', () => {
  const cell: ProgressCell = { value: null };
  return () => new InMemoryProgressRepository(cell);
});
