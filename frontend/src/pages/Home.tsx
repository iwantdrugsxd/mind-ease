import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Heart, Shield, Users, BarChart3, ArrowRight, CheckCircle } from 'lucide-react';

const Home: React.FC = () => {
  const { user } = useAuth();

  const features = [
    {
      icon: <Shield className="h-8 w-8 text-primary-600" />,
      title: "AI-Powered Triage",
      description: "Advanced PHQ-9 and GAD-7 screening with intelligent risk assessment and automated escalation."
    },
    {
      icon: <Users className="h-8 w-8 text-primary-600" />,
      title: "Clinician Dashboard",
      description: "Comprehensive patient monitoring with de-identified trends and real-time alerts."
    },
    {
      icon: <Heart className="h-8 w-8 text-primary-600" />,
      title: "Self-Care Pathways",
      description: "Personalized exercises and interventions based on your mental health patterns."
    },
    {
      icon: <BarChart3 className="h-8 w-8 text-primary-600" />,
      title: "Progress Tracking",
      description: "Monitor your mental health journey with detailed analytics and insights."
    }
  ];

  const benefits = [
    "Early detection of mental health issues",
    "Automated risk assessment and alerts",
    "Personalized self-care recommendations",
    "Seamless integration with healthcare providers",
    "24/7 crisis support and intervention",
    "Privacy-focused and HIPAA compliant"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Your Mental Health
              <span className="text-primary-600"> Companion</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Advanced AI-powered mental health screening, personalized self-care pathways, 
              and seamless integration with healthcare providers for comprehensive mental wellness.
            </p>
            {user ? (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/screening"
                  className="bg-primary-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center"
                >
                  Start Screening
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link
                  to="/selfcare"
                  className="bg-white text-primary-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors border-2 border-primary-600"
                >
                  Explore Self-Care
                </Link>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/register"
                  className="bg-primary-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-primary-700 transition-colors"
                >
                  Get Started
                </Link>
                <Link
                  to="/login"
                  className="bg-white text-primary-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors border-2 border-primary-600"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Comprehensive Mental Health Platform
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Combining cutting-edge AI technology with human-centered care to provide 
              the most effective mental health support system.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center p-6 rounded-lg hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Choose MindEase?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our platform is designed with your mental health and privacy in mind, 
              providing evidence-based care with the latest technology.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-lg text-gray-700">{benefit}</span>
                </div>
              ))}
            </div>
            <div className="bg-primary-600 rounded-lg p-8 text-white">
              <h3 className="text-2xl font-bold mb-4">Crisis Support</h3>
              <p className="text-lg mb-6">
                If you're experiencing a mental health crisis, please reach out for immediate help.
              </p>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <span className="font-semibold">Crisis Hotline:</span>
                  <a href="tel:988" className="text-yellow-300 hover:text-yellow-200">
                    988
                  </a>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="font-semibold">Text HOME to:</span>
                  <span className="text-yellow-300">741741</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-primary-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Take Control of Your Mental Health?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
            Join thousands of users who have improved their mental wellness with our 
            evidence-based approach and personalized care.
          </p>
          {!user && (
            <Link
              to="/register"
              className="bg-white text-primary-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors inline-flex items-center"
            >
              Start Your Journey Today
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;







