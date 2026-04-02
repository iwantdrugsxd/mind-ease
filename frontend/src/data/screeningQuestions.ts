export interface ScreeningQuestionItem {
  id: string;
  text: string;
  key: string;
}

export const phq9Questions: ScreeningQuestionItem[] = [
  { id: 'q1', text: 'Little interest or pleasure in doing things', key: 'q1_interest' },
  { id: 'q2', text: 'Feeling down, depressed, or hopeless', key: 'q2_depressed' },
  { id: 'q3', text: 'Trouble falling or staying asleep, or sleeping too much', key: 'q3_sleep' },
  { id: 'q4', text: 'Feeling tired or having little energy', key: 'q4_energy' },
  { id: 'q5', text: 'Poor appetite or overeating', key: 'q5_appetite' },
  {
    id: 'q6',
    text: 'Feeling bad about yourself or that you are a failure or have let yourself or your family down',
    key: 'q6_self_esteem',
  },
  {
    id: 'q7',
    text: 'Trouble concentrating on things, such as reading the newspaper or watching television',
    key: 'q7_concentration',
  },
  {
    id: 'q8',
    text: 'Moving or speaking so slowly that other people could have noticed, or the opposite - being so fidgety or restless that you have been moving around a lot more than usual',
    key: 'q8_psychomotor',
  },
  {
    id: 'q9',
    text: 'Thoughts that you would be better off dead, or of hurting yourself',
    key: 'q9_suicidal',
  },
];

export const gad7Questions: ScreeningQuestionItem[] = [
  { id: 'q1', text: 'Feeling nervous, anxious, or on edge', key: 'q1_nervous' },
  { id: 'q2', text: 'Not being able to stop or control worrying', key: 'q2_worry' },
  { id: 'q3', text: 'Worrying too much about different things', key: 'q3_worry_control' },
  { id: 'q4', text: 'Trouble relaxing', key: 'q4_trouble_relaxing' },
  { id: 'q5', text: 'Being so restless that it is hard to sit still', key: 'q5_restless' },
  { id: 'q6', text: 'Becoming easily annoyed or irritable', key: 'q6_irritable' },
  { id: 'q7', text: 'Feeling afraid, as if something awful might happen', key: 'q7_afraid' },
];

export const FREQUENCY_PROMPT =
  'Over the last 2 weeks, how often have you been bothered by this problem?';

export const FREQUENCY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
];
