
import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Copy, Trash2, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [hasRecognitionSupport, setHasRecognitionSupport] = useState(false);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  const languages = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'hi-IN', name: 'Hindi' },
    { code: 'es-ES', name: 'Spanish' },
    { code: 'fr-FR', name: 'French' },
    { code: 'de-DE', name: 'German' },
    { code: 'zh-CN', name: 'Chinese (Mandarin)' },
    { code: 'ja-JP', name: 'Japanese' },
    { code: 'ko-KR', name: 'Korean' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)' }
  ];

  useEffect(() => {
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

        setTranscript(prev => prev + finalTranscript);
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
      };
    }
  }, [selectedLanguage, toast]);

  const startListening = () => {
    if (recognitionRef.current && hasRecognitionSupport) {
      recognitionRef.current.start();
      setIsListening(true);
      toast({
        title: "Listening Started",
        description: "Start speaking now..."
      });
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      toast({
        title: "Listening Stopped",
        description: "Speech recognition has been stopped."
      });
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      toast({
        title: "Copied!",
        description: "Transcript copied to clipboard."
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Unable to copy to clipboard.",
        variant: "destructive"
      });
    }
  };

  const clearTranscript = () => {
    setTranscript('');
    toast({
      title: "Cleared",
      description: "Transcript has been cleared."
    });
  };

  const handleLanguageChange = (value: string) => {
    setSelectedLanguage(value);
    if (recognitionRef.current) {
      recognitionRef.current.lang = value;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 pt-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Volume2 className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">Speech Recognition Platform</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Transform your voice into text with our advanced speech recognition technology. 
            Perfect for transcription, note-taking, and accessibility.
          </p>
        </div>

        {/* Main Control Panel */}
        <Card className="p-8 shadow-lg border-0 bg-white/70 backdrop-blur-sm">
          <div className="space-y-6">
            {/* Language Selector */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Select Language:
              </label>
              <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Choose language" />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Microphone Button */}
            <div className="flex justify-center">
              {hasRecognitionSupport ? (
                <Button
                  onClick={isListening ? stopListening : startListening}
                  className={`h-20 w-20 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl ${
                    isListening 
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isListening ? (
                    <MicOff className="h-8 w-8 text-white" />
                  ) : (
                    <Mic className="h-8 w-8 text-white" />
                  )}
                </Button>
              ) : (
                <div className="text-center space-y-2">
                  <Button disabled className="h-20 w-20 rounded-full bg-gray-400">
                    <MicOff className="h-8 w-8" />
                  </Button>
                  <p className="text-sm text-red-600">
                    Speech recognition not supported in this browser
                  </p>
                </div>
              )}
            </div>

            {/* Status Indicator */}
            <div className="text-center">
              <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium ${
                isListening 
                  ? 'bg-red-100 text-red-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
                }`} />
                {isListening ? 'Listening...' : 'Ready to listen'}
              </div>
            </div>
          </div>
        </Card>

        {/* Transcript Area */}
        <Card className="p-6 shadow-lg border-0 bg-white/70 backdrop-blur-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Transcript</h2>
              <div className="flex space-x-2">
                <Button
                  onClick={copyToClipboard}
                  variant="outline"
                  size="sm"
                  disabled={!transcript}
                  className="flex items-center space-x-1"
                >
                  <Copy className="h-4 w-4" />
                  <span>Copy</span>
                </Button>
                <Button
                  onClick={clearTranscript}
                  variant="outline"
                  size="sm"
                  disabled={!transcript}
                  className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Clear</span>
                </Button>
              </div>
            </div>

            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Your speech will appear here... You can also type or edit the text manually."
              className="min-h-[200px] text-base leading-relaxed resize-none border-gray-200 focus:border-blue-500 focus:ring-blue-500"
            />

            {transcript && (
              <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                <strong>Word count:</strong> {transcript.trim().split(/\s+/).filter(word => word.length > 0).length} words |{' '}
                <strong>Character count:</strong> {transcript.length} characters
              </div>
            )}
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 pb-8">
          <p>
            Speech Recognition Platform - Built with React, Vite, and TailwindCSS
          </p>
          <p className="mt-1">
            {hasRecognitionSupport 
              ? 'Web Speech API is supported in your browser' 
              : 'Please use Chrome, Edge, or Safari for full functionality'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
