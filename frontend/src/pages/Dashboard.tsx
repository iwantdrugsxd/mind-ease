import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3, TrendingUp, AlertTriangle, Calendar, Activity, Heart, User, Clock, Mail } from 'lucide-react';
import api from '../utils/api';

interface DashboardStats {
  totalScreenings: number;
  highRiskAlerts: number;
  completedExercises: number;
  moodTrend: number;
  lastScreening: string;
  riskLevel: string;
}

interface PatientCard {
  id: number;
  firebase_uid: string;
  created_at: string;
  updated_at: string;
  user?: {
    email: string;
    first_name: string;
    last_name: string;
  };
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalScreenings: 0,
    highRiskAlerts: 0,
    completedExercises: 0,
    moodTrend: 0,
    lastScreening: '',
    riskLevel: 'low'
  });
  const [patientCard, setPatientCard] = useState<PatientCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // Load patient card
        if (user?.id) {
          try {
            // Include firebase_uid in query params to fetch the correct patient
            const patientResponse = await api.get<{
              count: number;
              results: PatientCard[];
            }>(`/screening/patients/?firebase_uid=${encodeURIComponent(user.id)}`);
            if (patientResponse.data && patientResponse.data.results && patientResponse.data.results.length > 0) {
              setPatientCard(patientResponse.data.results[0]);
            } else {
              // If no patient found, try to create one
              try {
                const createResponse = await api.post<PatientCard>('/screening/patients/', {
                  firebase_uid: user.id
                });
                setPatientCard(createResponse.data);
              } catch (createError) {
                console.warn('Could not create patient card:', createError);
              }
            }
          } catch (error) {
            console.warn('Could not load patient card:', error);
            // Try to create patient card if loading fails
            try {
              const createResponse = await api.post<PatientCard>('/screening/patients/', {
                firebase_uid: user.id
              });
              setPatientCard(createResponse.data);
            } catch (createError) {
              console.warn('Could not create patient card:', createError);
            }
          }
        }

        // Simulate loading other stats
        setTimeout(() => {
          setStats({
            totalScreenings: 12,
            highRiskAlerts: 2,
            completedExercises: 8,
            moodTrend: 15,
            lastScreening: new Date().toLocaleDateString(),
            riskLevel: 'medium'
          });
          setLoading(false);
        }, 1000);
      } catch (error) {
        console.error('Error loading dashboard:', error);
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

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
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Please log in to access dashboard</h2>
          <p className="text-gray-600">You need to be logged in to view your personal dashboard.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 py-6 sm:py-8 px-2 sm:px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Welcome back, {user.name}!</h1>
          <p className="text-base sm:text-lg text-gray-600 mt-2">Here's an overview of your mental health journey.</p>
        </div>

        {/* Patient Card Section */}
        {patientCard && (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6 sm:mb-8 border border-gray-200">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-md">
                  <User className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                    {patientCard.user?.first_name || user.name} {patientCard.user?.last_name || ''}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <Mail className="h-4 w-4" />
                    <span>{patientCard.user?.email || user.email}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span>Created: {formatDate(patientCard.created_at)}</span>
                    </div>
                    {patientCard.updated_at !== patientCard.created_at && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span>Updated: {formatDate(patientCard.updated_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-3 py-1.5 bg-primary-100 text-primary-700 rounded-full text-xs sm:text-sm font-medium">
                Patient ID: {patientCard.id}
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-4 sm:p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-primary-100 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />
                </div>
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Total Screenings</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900">{stats.totalScreenings}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-4 sm:p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-orange-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-500">High Risk Alerts</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900">{stats.highRiskAlerts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-4 sm:p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Exercises Completed</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900">{stats.completedExercises}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-4 sm:p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Mood Improvement</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900">+{stats.moodTrend}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Risk Assessment */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Current Risk Assessment</h3>
              
              <div className="mb-4 sm:mb-6">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <span className="text-sm sm:text-base font-medium text-gray-700">Risk Level</span>
                  <span className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium ${getRiskColor(stats.riskLevel)}`}>
                    {stats.riskLevel.charAt(0).toUpperCase() + stats.riskLevel.slice(1)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 sm:h-3">
                  <div 
                    className={`h-2.5 sm:h-3 rounded-full transition-all duration-500 ${
                      stats.riskLevel === 'critical' ? 'bg-red-500' :
                      stats.riskLevel === 'high' ? 'bg-orange-500' :
                      stats.riskLevel === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ 
                      width: stats.riskLevel === 'critical' ? '100%' :
                             stats.riskLevel === 'high' ? '75%' :
                             stats.riskLevel === 'medium' ? '50%' : '25%'
                    }}
                  ></div>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <Calendar className="h-5 w-5 text-primary-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Last Screening</p>
                    <p className="text-xs sm:text-sm text-gray-500">{stats.lastScreening || 'No screenings yet'}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <Heart className="h-5 w-5 text-primary-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Next Recommended Screening</p>
                    <p className="text-xs sm:text-sm text-gray-500">In 2 weeks</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Quick Actions</h3>
              <div className="space-y-2 sm:space-y-3">
                <button 
                  onClick={() => window.location.href = '/screening'}
                  className="w-full bg-primary-600 text-white py-2.5 sm:py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors text-left text-sm sm:text-base font-medium shadow-md hover:shadow-lg touch-manipulation"
                >
                  Take New Screening
                </button>
                <button 
                  onClick={() => window.location.href = '/self-care'}
                  className="w-full bg-gray-200 text-gray-800 py-2.5 sm:py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors text-left text-sm sm:text-base font-medium touch-manipulation"
                >
                  Start Self-Care Exercise
                </button>
                <button 
                  onClick={() => window.location.href = '/chatbot'}
                  className="w-full bg-gray-200 text-gray-800 py-2.5 sm:py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors text-left text-sm sm:text-base font-medium touch-manipulation"
                >
                  Chat with Support
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Recent Activity</h3>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center space-x-3 py-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                  <p className="text-xs sm:text-sm text-gray-600">Completed breathing exercise</p>
                </div>
                <div className="flex items-center space-x-3 py-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                  <p className="text-xs sm:text-sm text-gray-600">PHQ-9 screening completed</p>
                </div>
                <div className="flex items-center space-x-3 py-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full flex-shrink-0"></div>
                  <p className="text-xs sm:text-sm text-gray-600">Mood entry logged</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="mt-6 sm:mt-8">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Personalized Recommendations</h3>
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h4 className="font-medium text-gray-900 text-sm sm:text-base">Based on your recent screening:</h4>
                <ul className="space-y-2 text-xs sm:text-sm text-gray-600">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Consider daily mindfulness exercises</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Practice stress management techniques</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Maintain regular sleep schedule</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Stay connected with support network</span>
                  </li>
                </ul>
              </div>
              <div className="space-y-3 p-4 bg-purple-50 rounded-lg border border-purple-100">
                <h4 className="font-medium text-gray-900 text-sm sm:text-base">Upcoming milestones:</h4>
                <ul className="space-y-2 text-xs sm:text-sm text-gray-600">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Complete 10 self-care exercises (2 remaining)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Maintain 7-day mood tracking streak</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Schedule next screening in 2 weeks</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
