import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import api from '../utils/api';

interface PHQ9Question {
  id: string;
  text: string;
  key: string;
}

const phq9Questions: PHQ9Question[] = [
  {
    id: 'q1',
    text: 'Little interest or pleasure in doing things',
    key: 'q1_interest'
  },
  {
    id: 'q2',
    text: 'Feeling down, depressed, or hopeless',
    key: 'q2_depressed'
  },
  {
    id: 'q3',
    text: 'Trouble falling or staying asleep, or sleeping too much',
    key: 'q3_sleep'
  },
  {
    id: 'q4',
    text: 'Feeling tired or having little energy',
    key: 'q4_energy'
  },
  {
    id: 'q5',
    text: 'Poor appetite or overeating',
    key: 'q5_appetite'
  },
  {
    id: 'q6',
    text: 'Feeling bad about yourself or that you are a failure or have let yourself or your family down',
    key: 'q6_self_esteem'
  },
  {
    id: 'q7',
    text: 'Trouble concentrating on things, such as reading the newspaper or watching television',
    key: 'q7_concentration'
  },
  {
    id: 'q8',
    text: 'Moving or speaking so slowly that other people could have noticed, or the opposite - being so fidgety or restless that you have been moving around a lot more than usual',
    key: 'q8_psychomotor'
  },
  {
    id: 'q9',
    text: 'Thoughts that you would be better off dead, or of hurting yourself',
    key: 'q9_suicidal'
  }
];

const gad7Questions: PHQ9Question[] = [
  {
    id: 'q1',
    text: 'Feeling nervous, anxious, or on edge',
    key: 'q1_nervous'
  },
  {
    id: 'q2',
    text: 'Not being able to stop or control worrying',
    key: 'q2_worry'
  },
  {
    id: 'q3',
    text: 'Worrying too much about different things',
    key: 'q3_worry_control'
  },
  {
    id: 'q4',
    text: 'Trouble relaxing',
    key: 'q4_trouble_relaxing'
  },
  {
    id: 'q5',
    text: 'Being so restless that it is hard to sit still',
    key: 'q5_restless'
  },
  {
    id: 'q6',
    text: 'Becoming easily annoyed or irritable',
    key: 'q6_irritable'
  },
  {
    id: 'q7',
    text: 'Feeling afraid, as if something awful might happen',
    key: 'q7_afraid'
  }
];

const Screening: React.FC = () => {
  const { user } = useAuth();
  const [currentTest, setCurrentTest] = useState<'phq9' | 'gad7' | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const questions = currentTest === 'phq9' ? phq9Questions : gad7Questions;

  const handleAnswer = (questionKey: string, value: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionKey]: value
    }));
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      submitScreening();
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const submitScreening = async () => {
    setIsSubmitting(true);
    try {
      // Calculate total score
      const totalScore = Object.values(answers).reduce((sum, score) => sum + score, 0);
      
      // Determine severity
      let severity = 'minimal';
      if (currentTest === 'phq9') {
        if (totalScore <= 4) severity = 'minimal';
        else if (totalScore <= 9) severity = 'mild';
        else if (totalScore <= 14) severity = 'moderate';
        else if (totalScore <= 19) severity = 'moderately_severe';
        else severity = 'severe';
      } else {
        if (totalScore <= 4) severity = 'minimal';
        else if (totalScore <= 9) severity = 'mild';
        else if (totalScore <= 14) severity = 'moderate';
        else severity = 'severe';
      }

      // Determine risk level
      let riskLevel = 'low';
      let requiresAttention = false;
      
      if (currentTest === 'phq9') {
        if (totalScore >= 15 || answers.q9_suicidal >= 2) {
          riskLevel = 'critical';
          requiresAttention = true;
        } else if (totalScore >= 10) {
          riskLevel = 'high';
          requiresAttention = true;
        } else if (totalScore >= 5) {
          riskLevel = 'medium';
        }
      } else {
        if (totalScore >= 15) {
          riskLevel = 'critical';
          requiresAttention = true;
        } else if (totalScore >= 10) {
          riskLevel = 'high';
          requiresAttention = true;
        } else if (totalScore >= 5) {
          riskLevel = 'medium';
        }
      }

      const result = {
        testType: currentTest,
        totalScore,
        severity,
        riskLevel,
        requiresAttention,
        answers
      };

      setResult(result);
      
      // Send to backend API
      try {
        // Ensure patient card exists first
        try {
          await api.post('/screening/patients/', {
            firebase_uid: user?.id || ''
          });
          console.log('Patient card created/updated on screening submission');
        } catch (patientError: any) {
          console.warn('Patient card may already exist:', patientError);
        }

        // Prepare screening data in the format expected by the backend
        const screeningData: any = {
          ...answers,
          firebase_uid: user?.id || ''
        };

        // Use the existing screening endpoints which handle patient creation
        if (currentTest === 'phq9') {
          await api.post('/screening/phq9-screenings/', screeningData);
        } else {
          await api.post('/screening/gad7-screenings/', screeningData);
        }
        
        console.log('Screening result saved to backend:', result);
      } catch (apiError: any) {
        console.error('Error saving screening to backend:', apiError);
        // Still show result even if API call fails
      }
      
    } catch (error) {
      console.error('Error submitting screening:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetScreening = () => {
    setCurrentTest(null);
    setCurrentQuestion(0);
    setAnswers({});
    setResult(null);
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-green-600 bg-green-100';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Please log in to access screening</h2>
          <p className="text-gray-600">You need to be logged in to complete mental health screenings.</p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 py-6 sm:py-12 px-2 sm:px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
                {currentTest?.toUpperCase()} Screening Results
              </h2>
              <div className={`inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium ${getRiskColor(result.riskLevel)}`}>
                {result.riskLevel.charAt(0).toUpperCase() + result.riskLevel.slice(1)} Risk
              </div>
            </div>

            <div className="space-y-4 sm:space-y-6">
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-primary-600 mb-2">
                  {result.totalScore}
                </div>
                <div className="text-base sm:text-lg text-gray-600">
                  Total Score (Severity: {result.severity.replace('_', ' ')})
                </div>
              </div>

              {result.requiresAttention && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-2 sm:mr-3 flex-shrink-0" />
                    <div>
                      <h3 className="text-sm font-medium text-red-800">Attention Required</h3>
                      <p className="text-xs sm:text-sm text-red-700 mt-1">
                        Your screening results indicate that you may benefit from professional support. 
                        Please consider reaching out to a mental health professional or your healthcare provider.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">Recommendations</h3>
                <ul className="text-xs sm:text-sm text-blue-700 space-y-1">
                  {result.riskLevel === 'critical' && (
                    <li>• Consider immediate professional help or crisis intervention</li>
                  )}
                  {result.riskLevel === 'high' && (
                    <li>• Schedule an appointment with a mental health professional</li>
                  )}
                  {result.riskLevel === 'medium' && (
                    <li>• Consider self-care strategies and regular monitoring</li>
                  )}
                  <li>• Continue regular mental health check-ins</li>
                  <li>• Practice stress management techniques</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button
                  onClick={resetScreening}
                  className="flex-1 bg-primary-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors touch-manipulation text-sm sm:text-base"
                >
                  Take Another Screening
                </button>
                <button
                  onClick={() => window.location.href = '/selfcare'}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors touch-manipulation text-sm sm:text-base"
                >
                  Explore Self-Care
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentTest) {
    return (
      <div className="min-h-screen bg-gray-50 py-6 sm:py-12 px-2 sm:px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 px-2">
              Mental Health Screening
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-3xl mx-auto px-4">
              Choose a screening tool to assess your current mental health status. 
              These are evidence-based questionnaires used by healthcare professionals.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8 px-2">
            <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 hover:shadow-xl transition-shadow">
              <div className="text-center">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">PHQ-9 Depression Screening</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
                  A 9-question screening tool for depression. Takes about 3-5 minutes to complete.
                </p>
                <button
                  onClick={() => setCurrentTest('phq9')}
                  className="w-full sm:w-auto bg-primary-600 text-white px-6 sm:px-8 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors touch-manipulation text-sm sm:text-base"
                >
                  Start PHQ-9 Screening
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 hover:shadow-xl transition-shadow">
              <div className="text-center">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">GAD-7 Anxiety Screening</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
                  A 7-question screening tool for anxiety disorders. Takes about 2-3 minutes to complete.
                </p>
                <button
                  onClick={() => setCurrentTest('gad7')}
                  className="w-full sm:w-auto bg-primary-600 text-white px-6 sm:px-8 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors touch-manipulation text-sm sm:text-base"
                >
                  Start GAD-7 Screening
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8 px-2 sm:px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8">
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                {currentTest?.toUpperCase()} Question {currentQuestion + 1} of {questions.length}
              </h2>
              <div className="text-xs sm:text-sm text-gray-500">
                {Math.round(((currentQuestion + 1) / questions.length) * 100)}% Complete
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="mb-6 sm:mb-8">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4 sm:mb-6 leading-tight">
              {questions[currentQuestion].text}
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
              Over the last 2 weeks, how often have you been bothered by this problem?
            </p>

            <div className="space-y-2 sm:space-y-3">
              {[
                { value: 0, label: 'Not at all' },
                { value: 1, label: 'Several days' },
                { value: 2, label: 'More than half the days' },
                { value: 3, label: 'Nearly every day' }
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center p-3 sm:p-4 rounded-lg border-2 cursor-pointer transition-colors touch-manipulation ${
                    answers[questions[currentQuestion].key] === option.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300 active:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={questions[currentQuestion].key}
                    value={option.value}
                    checked={answers[questions[currentQuestion].key] === option.value}
                    onChange={() => handleAnswer(questions[currentQuestion].key, option.value)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 sm:w-4 sm:h-4 rounded-full border-2 mr-3 flex-shrink-0 ${
                    answers[questions[currentQuestion].key] === option.value
                      ? 'border-primary-500 bg-primary-500'
                      : 'border-gray-300'
                  }`}>
                    {answers[questions[currentQuestion].key] === option.value && (
                      <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                    )}
                  </div>
                  <span className="text-sm sm:text-base text-gray-700 flex-1">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-between gap-3 sm:gap-4">
            <button
              onClick={prevQuestion}
              disabled={currentQuestion === 0}
              className="flex items-center px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
            </button>

            <button
              onClick={nextQuestion}
              disabled={answers[questions[currentQuestion].key] === undefined}
              className="flex items-center px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation font-medium"
            >
              <span>{currentQuestion === questions.length - 1 ? 'Submit' : 'Next'}</span>
              {currentQuestion !== questions.length - 1 && <ArrowRight className="h-4 w-4 ml-1 sm:ml-2" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Screening;
