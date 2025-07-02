import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Copy, Trash2, Volume2, Sparkles, Radio, Bot, User, MessageCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

const Index = () => {
  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [hasRecognitionSupport, setHasRecognitionSupport] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const [silenceTimer, setSilenceTimer] = useState<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null);
  const { toast } = useToast();

  const languages = [
    { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
    { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
    { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳' },
    { code: 'es-ES', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr-FR', name: 'French', flag: '🇫🇷' },
    { code: 'de-DE', name: 'German', flag: '🇩🇪' },
    { code: 'zh-CN', name: 'Chinese (Mandarin)', flag: '🇨🇳' },
    { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko-KR', name: 'Korean', flag: '🇰🇷' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)', flag: '🇧🇷' }
  ];

  const callBackendAPI = async (userMessage: string): Promise<string> => {
    try {
      const response = await fetch('http://127.0.0.1:8000/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input_text: userMessage
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.output_text;
    } catch (error) {
      console.error('Backend API Error:', error);
      throw new Error('Failed to get response from AI backend');
    }
  };


  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();      
      setIsAiSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      
      utterance.onend = () => {
        setIsAiSpeaking(false);
        // Automatically start listening again after AI finishes speaking
        setTimeout(() => {
          if (hasRecognitionSupport && !isListening) {
            startListening();
          }
        }, 500);
      };
      
      utterance.onerror = () => {
        setIsAiSpeaking(false);
      };
      
      speechSynthesis.speak(utterance);
    }
  };

  const addMessage = (content: string, type: 'user' | 'ai') => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  };

  const handleUserSpeechComplete = async (transcript: string) => {
    if (transcript.trim()) {
      // Add user message
      addMessage(transcript, 'user');
      
      // Set loading state
      setIsProcessingRequest(true);
      
      try {
        // Call backend API
        const aiResponse = await callBackendAPI(transcript);
        
        // Add AI response
        addMessage(aiResponse, 'ai');
        
        // Speak the AI response
        speakText(aiResponse);
        
      } catch (error) {
        console.error('Error getting AI response:', error);
        const errorMessage = "Sorry, I'm having trouble connecting to the AI service. Please try again.";
        addMessage(errorMessage, 'ai');
        speakText(errorMessage);
      } finally {
        setIsProcessingRequest(false);
      }
    }
  };

  useEffect(() => {
    speechSynthesisRef.current = window.speechSynthesis;
    
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setHasRecognitionSupport(true);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = selectedLanguage;

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptText = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptText;
          } else {
            interimTranscript += transcriptText;
          }
        }

        if (finalTranscript) {
          setCurrentTranscript(finalTranscript);
          
          // Clear existing timer
          if (silenceTimer) {
            clearTimeout(silenceTimer);
          }
          
          // Set new timer for 3 seconds of silence
          const timer = setTimeout(() => {
            handleUserSpeechComplete(finalTranscript);
            setCurrentTranscript('');
            stopListening();
          }, 3000);
          
          setSilenceTimer(timer);
        } else {
          setCurrentTranscript(interimTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast({
          title: "Recognition Error",
          description: `Speech recognition failed: ${event.error}`,
          variant: "destructive"
        });
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          setSilenceTimer(null);
        }
      };
    }

    return () => {
      if (silenceTimer) {
        clearTimeout(silenceTimer);
      }
    };
  }, [selectedLanguage, silenceTimer]);

  const startListening = () => {
    if (recognitionRef.current && hasRecognitionSupport && !isAiSpeaking && !isProcessingRequest) {
      recognitionRef.current.start();
      setIsListening(true);
      toast({
        title: "Listening Started",
        description: "Start speaking... I'll respond after 3 seconds of silence."
      });
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        setSilenceTimer(null);
      }
      toast({
        title: "Listening Stopped",
        description: "Conversation paused."
      });
    }
  };

  const copyAllMessages = async () => {
    const allText = messages.map(msg => 
      `${msg.type === 'user' ? 'You' : 'AI'}: ${msg.content}`
    ).join('\n\n');
    
    try {
      await navigator.clipboard.writeText(allText);
      toast({
        title: "Copied!",
        description: "Conversation copied to clipboard."
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Unable to copy to clipboard.",
        variant: "destructive"
      });
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setCurrentTranscript('');
    // Stop any ongoing speech
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      setIsAiSpeaking(false);
    }
    toast({
      title: "Cleared",
      description: "Conversation has been cleared."
    });
  };

  const handleLanguageChange = (value: string) => {
    setSelectedLanguage(value);
    if (recognitionRef.current) {
      recognitionRef.current.lang = value;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-300/30 to-pink-300/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-300/30 to-cyan-300/30 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-indigo-300/20 to-purple-300/20 rounded-full blur-2xl"></div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="text-center space-y-6 mb-12">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="relative">
              <MessageCircle className="h-12 w-12 text-purple-600" />
              <Sparkles className="h-6 w-6 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
              AI Conversation Hub
            </h1>
          </div>
          
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Experience natural <span className="font-semibold text-purple-600">two-way conversations</span> with AI. 
            Speak naturally and get intelligent responses powered by LLaMA 3.2.
          </p>
          
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <div className="px-4 py-2 text-sm bg-purple-100 text-purple-700 border border-purple-200 rounded-full flex items-center">
              <Bot className="w-4 h-4 mr-2" />
              LLaMA 3.2 90B powered
            </div>
            <div className="px-4 py-2 text-sm bg-blue-100 text-blue-700 border border-blue-200 rounded-full flex items-center">
              <Radio className="w-4 h-4 mr-2" />
              Live conversation
            </div>
            <div className="px-4 py-2 text-sm bg-cyan-100 text-cyan-700 border border-cyan-200 rounded-full">
              ⏱️ 3-second auto-response
            </div>
          </div>
        </div>

        {/* Main Control Panel */}
        <div className="p-8 mb-8 shadow-2xl border-0 bg-white/80 backdrop-blur-xl rounded-3xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-blue-500/5 to-cyan-500/5"></div>
          <div className="relative z-10 space-y-8">
            {/* Language Selector */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between space-y-4 lg:space-y-0">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-8 bg-gradient-to-b from-purple-500 to-blue-500 rounded-full"></div>
                <label className="text-lg font-semibold text-gray-800">
                  Conversation Language
                </label>
              </div>
              <select 
                value={selectedLanguage} 
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="w-full lg:w-80 h-12 bg-white/80 border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 px-4"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Microphone Section */}
            <div className="flex flex-col items-center space-y-6">
              {hasRecognitionSupport ? (
                <div className="relative">
                  {/* Animated rings for listening/processing state */}
                  {(isListening || isAiSpeaking || isProcessingRequest) && (
                    <>
                      <div className={`absolute inset-0 rounded-full animate-ping ${
                        isProcessingRequest ? 'bg-yellow-400/30' :
                        isAiSpeaking ? 'bg-blue-400/30' : 'bg-red-400/30'
                      }`}></div>
                      <div className={`absolute inset-0 rounded-full animate-ping animation-delay-75 ${
                        isProcessingRequest ? 'bg-yellow-400/20' :
                        isAiSpeaking ? 'bg-blue-400/20' : 'bg-red-400/20'
                      }`}></div>
                      <div className={`absolute inset-0 rounded-full animate-ping animation-delay-150 ${
                        isProcessingRequest ? 'bg-yellow-400/10' :
                        isAiSpeaking ? 'bg-blue-400/10' : 'bg-red-400/10'
                      }`}></div>
                    </>
                  )}
                  
                  <button
                    onClick={isListening ? stopListening : startListening}
                    disabled={isAiSpeaking || isProcessingRequest}
                    className={`h-24 w-24 rounded-full transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:scale-105 flex items-center justify-center ${
                      isProcessingRequest
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500 cursor-not-allowed'
                        : isAiSpeaking
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500 cursor-not-allowed'
                          : isListening 
                            ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600' 
                            : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                    }`}
                  >
                    {isProcessingRequest ? (
                      <Loader2 className="h-10 w-10 text-white animate-spin" />
                    ) : isAiSpeaking ? (
                      <Bot className="h-10 w-10 text-white animate-pulse" />
                    ) : isListening ? (
                      <MicOff className="h-10 w-10 text-white animate-pulse" />
                    ) : (
                      <Mic className="h-10 w-10 text-white" />
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="relative">
                    <button disabled className="h-24 w-24 rounded-full bg-gray-300 shadow-lg flex items-center justify-center">
                      <MicOff className="h-10 w-10 text-gray-500" />
                    </button>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-red-700 font-medium">
                      🚫 Speech recognition not supported in this browser
                    </p>
                    <p className="text-red-600 text-sm mt-1">
                      Please use Chrome, Edge, or Safari for full functionality
                    </p>
                  </div>
                </div>
              )}

              {/* Status Indicator */}
              <div className={`flex items-center space-x-3 px-6 py-3 rounded-full text-sm font-medium transition-all duration-300 ${
                isProcessingRequest
                  ? 'bg-gradient-to-r from-yellow-100 to-orange-100 text-yellow-800 shadow-lg'
                  : isAiSpeaking
                    ? 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 shadow-lg'
                    : isListening 
                      ? 'bg-gradient-to-r from-red-100 to-pink-100 text-red-800 shadow-lg' 
                      : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 shadow-sm'
              }`}>
                <div className={`w-3 h-3 rounded-full ${
                  isProcessingRequest
                    ? 'bg-yellow-500 animate-pulse shadow-yellow-500/50 shadow-lg'
                    : isAiSpeaking 
                      ? 'bg-blue-500 animate-pulse shadow-blue-500/50 shadow-lg'
                      : isListening 
                        ? 'bg-red-500 animate-pulse shadow-red-500/50 shadow-lg' 
                        : 'bg-gray-400'
                }`} />
                <span className="text-base">
                  {isProcessingRequest
                    ? '⚡ Processing with AI...'
                    : isAiSpeaking 
                      ? '🤖 AI is speaking...' 
                      : isListening 
                        ? '🎤 Listening... (3s auto-response)' 
                        : '⏸️ Ready for conversation'
                  }
                </span>
              </div>

              {/* Current transcript */}
              {currentTranscript && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 max-w-2xl">
                  <p className="text-yellow-800 font-medium text-sm mb-1">Current speech:</p>
                  <p className="text-gray-700">{currentTranscript}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Conversation Area */}
        <div className="p-8 shadow-2xl border-0 bg-white/80 backdrop-blur-xl rounded-3xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5"></div>
          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></div>
                <h2 className="text-2xl font-bold text-gray-900">Live Conversation</h2>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={copyAllMessages}
                  disabled={messages.length === 0}
                  className="flex items-center space-x-2 bg-white/80 hover:bg-blue-50 border border-blue-200 text-blue-700 hover:text-blue-800 rounded-xl px-4 py-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Copy className="h-4 w-4" />
                  <span>Copy</span>
                </button>
                <button
                  onClick={clearConversation}
                  disabled={messages.length === 0}
                  className="flex items-center space-x-2 bg-white/80 hover:bg-red-50 border border-red-200 text-red-600 hover:text-red-700 rounded-xl px-4 py-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            {/* Messages Display */}
            <div className="min-h-[300px] max-h-[500px] overflow-y-auto space-y-4 bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-100">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">Start your conversation</p>
                  <p className="text-sm">Click the microphone button and begin speaking with AI</p>
                  <p className="text-xs mt-2 text-gray-400">Powered by LLaMA 3.2 90B Vision Instruct</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start space-x-3 ${
                      message.type === 'user' ? 'justify-end' : 'justify-start'
                    } animate-fade-in`}
                  >
                    {message.type === 'ai' && (
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-lg px-4 py-3 rounded-2xl ${
                        message.type === 'user'
                          ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.type === 'user' ? 'text-purple-100' : 'text-gray-500'
                      }`}>
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    {message.type === 'user' && (
                      <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {messages.length > 0 && (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-2xl border border-purple-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-purple-600">
                      {messages.filter(m => m.type === 'user').length}
                    </div>
                    <div className="text-sm text-purple-700 font-medium">Your Messages</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-blue-600">
                      {messages.filter(m => m.type === 'ai').length}
                    </div>
                    <div className="text-sm text-blue-700 font-medium">AI Responses</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-cyan-600">
                      {messages.length}
                    </div>
                    <div className="text-sm text-cyan-700 font-medium">Total Messages</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 space-y-4">
          <div className="flex items-center justify-center space-x-2 text-gray-600">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <p className="text-lg font-medium">
              AI Conversation Hub - Powered by LLaMA 3.2 90B
            </p>
            <Sparkles className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-gray-500">
            Built with React & FastAPI • 
            {hasRecognitionSupport 
              ? ' ✅ Voice & Speech API supported' 
              : ' ⚠️ Limited browser support'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
