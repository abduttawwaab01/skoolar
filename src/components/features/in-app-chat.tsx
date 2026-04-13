'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Send, Paperclip, MessageSquare, Plus, Phone, MoreVertical, Circle, Check, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  isRead: boolean;
}

interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  avatar: string;
  role: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline: boolean;
  messages: Message[];
}

// Development mock data - prefix with MOCK_ to clearly indicate it's not real production data
const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1',
    participantId: 'tch-1',
    participantName: 'Mrs. Adebayo Funke',
    avatar: 'AF',
    role: 'Mathematics Teacher',
    lastMessage: 'Please ensure the students complete the assignment by Friday.',
    lastMessageTime: '2:30 PM',
    unreadCount: 2,
    isOnline: true,
    messages: [
      { id: 'm-1', senderId: 'tch-1', senderName: 'Mrs. Adebayo Funke', content: 'Good afternoon! I wanted to discuss the upcoming mathematics test scheduled for next week.', timestamp: '1:15 PM', isRead: true },
      { id: 'm-2', senderId: 'me', senderName: 'You', content: 'Hello Mrs. Adebayo! Yes, I was planning to speak with you about that. What topics should be covered?', timestamp: '1:20 PM', isRead: true },
      { id: 'm-3', senderId: 'tch-1', senderName: 'Mrs. Adebayo Funke', content: 'The test will cover Algebra, Geometry, and Statistics from chapters 3-5. I have prepared a study guide.', timestamp: '1:25 PM', isRead: true },
      { id: 'm-4', senderId: 'me', senderName: 'You', content: 'That sounds comprehensive. Can you share the study guide with the students via the portal?', timestamp: '1:30 PM', isRead: true },
      { id: 'm-5', senderId: 'tch-1', senderName: 'Mrs. Adebayo Funke', content: 'I have uploaded it to the class resources section. Please ensure the students complete the assignment by Friday.', timestamp: '2:30 PM', isRead: false },
      { id: 'm-6', senderId: 'tch-1', senderName: 'Mrs. Adebayo Funke', content: 'Also, I noticed some students are struggling with geometry proofs. Could we arrange extra tutoring sessions?', timestamp: '2:32 PM', isRead: false },
    ],
  },
  {
    id: 'conv-2',
    participantId: 'tch-3',
    participantName: 'Dr. Ishaq Mohammed',
    avatar: 'IM',
    role: 'Physics Teacher',
    lastMessage: 'The lab equipment request has been approved.',
    lastMessageTime: '11:45 AM',
    unreadCount: 1,
    isOnline: true,
    messages: [
      { id: 'm-7', senderId: 'tch-3', senderName: 'Dr. Ishaq Mohammed', content: 'Good morning! I need to request some lab equipment for the SS 2A physics practical.', timestamp: '10:00 AM', isRead: true },
      { id: 'm-8', senderId: 'me', senderName: 'You', content: 'Good morning Dr. Ishaq. What equipment do you need? Please provide a detailed list.', timestamp: '10:15 AM', isRead: true },
      { id: 'm-9', senderId: 'tch-3', senderName: 'Dr. Ishaq Mohammed', content: 'We need 10 multimeters, 5 oscilloscopes, and various circuit components for the electricity module.', timestamp: '10:30 AM', isRead: true },
      { id: 'm-10', senderId: 'me', senderName: 'You', content: 'I will forward this to the procurement department. Please allow 2 weeks for processing.', timestamp: '11:00 AM', isRead: true },
      { id: 'm-11', senderId: 'tch-3', senderName: 'Dr. Ishaq Mohammed', content: 'The lab equipment request has been approved.', timestamp: '11:45 AM', isRead: false },
    ],
  },
  {
    id: 'conv-3',
    participantId: 'parent-1',
    participantName: 'Mr. Johnson (Parent)',
    avatar: 'MJ',
    role: 'Parent - Adewale Johnson',
    lastMessage: 'Thank you for the update on my son\'s progress.',
    lastMessageTime: 'Yesterday',
    unreadCount: 0,
    isOnline: false,
    messages: [
      { id: 'm-12', senderId: 'parent-1', senderName: 'Mr. Johnson', content: 'Good day. I would like to know how my son Adewale is performing in his classes.', timestamp: 'Yesterday 3:00 PM', isRead: true },
      { id: 'm-13', senderId: 'me', senderName: 'You', content: 'Good afternoon Mr. Johnson. Adewale is doing well! His current GPA is 3.8 and he has 96% attendance. His strongest subject is Computer Science.', timestamp: 'Yesterday 3:30 PM', isRead: true },
      { id: 'm-14', senderId: 'parent-1', senderName: 'Mr. Johnson', content: 'That is wonderful to hear. I will continue to encourage him at home.', timestamp: 'Yesterday 4:00 PM', isRead: true },
      { id: 'm-15', senderId: 'me', senderName: 'You', content: 'We appreciate your support. Adewale is also showing great leadership skills in class activities.', timestamp: 'Yesterday 4:15 PM', isRead: true },
      { id: 'm-16', senderId: 'parent-1', senderName: 'Mr. Johnson', content: 'Thank you for the update on my son\'s progress.', timestamp: 'Yesterday 4:30 PM', isRead: true },
    ],
  },
  {
    id: 'conv-4',
    participantId: 'tch-2',
    participantName: 'Mr. Okoro Chukwuma',
    avatar: 'OC',
    role: 'English Teacher',
    lastMessage: 'The essay competition results are ready.',
    lastMessageTime: 'Mon',
    unreadCount: 0,
    isOnline: false,
    messages: [
      { id: 'm-17', senderId: 'tch-2', senderName: 'Mr. Okoro Chukwuma', content: 'I wanted to inform you that the essay competition submissions have been graded.', timestamp: 'Mon 9:00 AM', isRead: true },
      { id: 'm-18', senderId: 'me', senderName: 'You', content: 'Excellent! How did our students perform?', timestamp: 'Mon 9:30 AM', isRead: true },
      { id: 'm-19', senderId: 'tch-2', senderName: 'Mr. Okoro Chukwuma', content: 'Very well! 3 students placed in the top 10. Fatima Bello came first overall.', timestamp: 'Mon 10:00 AM', isRead: true },
      { id: 'm-20', senderId: 'me', senderName: 'You', content: 'Fantastic! Please prepare certificates for the winners.', timestamp: 'Mon 10:15 AM', isRead: true },
      { id: 'm-21', senderId: 'tch-2', senderName: 'Mr. Okoro Chukwuma', content: 'The essay competition results are ready.', timestamp: 'Mon 2:00 PM', isRead: true },
    ],
  },
  {
    id: 'conv-5',
    participantId: 'tch-7',
    participantName: 'Mr. Garba Abdul',
    avatar: 'GA',
    role: 'Computer Science Teacher',
    lastMessage: 'The coding club registration is now open.',
    lastMessageTime: 'Sun',
    unreadCount: 0,
    isOnline: true,
    messages: [
      { id: 'm-22', senderId: 'tch-7', senderName: 'Mr. Garba Abdul', content: 'I would like to start a coding club for interested students. What do you think?', timestamp: 'Sun 10:00 AM', isRead: true },
      { id: 'm-23', senderId: 'me', senderName: 'You', content: 'That is a great initiative! We have been looking to add more extracurricular activities.', timestamp: 'Sun 11:00 AM', isRead: true },
      { id: 'm-24', senderId: 'tch-7', senderName: 'Mr. Garba Abdul', content: 'Perfect. I will set up the registration portal. We can start with Python basics.', timestamp: 'Sun 11:30 AM', isRead: true },
      { id: 'm-25', senderId: 'me', senderName: 'You', content: 'Please keep me updated on the registration numbers. We may need to set a capacity limit.', timestamp: 'Sun 12:00 PM', isRead: true },
      { id: 'm-26', senderId: 'tch-7', senderName: 'Mr. Garba Abdul', content: 'The coding club registration is now open.', timestamp: 'Sun 3:00 PM', isRead: true },
    ],
  },
  {
    id: 'conv-6',
    participantId: 'parent-2',
    participantName: 'Mrs. Bello (Parent)',
    avatar: 'MB',
    role: 'Parent - Fatima Bello',
    lastMessage: 'When is the next parent-teacher conference?',
    lastMessageTime: 'Sat',
    unreadCount: 0,
    isOnline: false,
    messages: [
      { id: 'm-27', senderId: 'parent-2', senderName: 'Mrs. Bello', content: 'Good evening. When is the next parent-teacher conference?', timestamp: 'Sat 6:00 PM', isRead: true },
      { id: 'm-28', senderId: 'me', senderName: 'You', content: 'Good evening Mrs. Bello! The next PTA meeting is scheduled for April 12, 2025 from 10 AM to 3 PM.', timestamp: 'Sat 6:30 PM', isRead: true },
      { id: 'm-29', senderId: 'parent-2', senderName: 'Mrs. Bello', content: 'Thank you. I will make sure to attend. Is there anything specific I should prepare?', timestamp: 'Sat 7:00 PM', isRead: true },
      { id: 'm-30', senderId: 'me', senderName: 'You', content: 'Just bring your child\'s previous term report card. You will have the opportunity to meet with all subject teachers.', timestamp: 'Sat 7:30 PM', isRead: true },
    ],
  },
];

export default function InAppChat() {
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [selectedConversation, setSelectedConversation] = useState<string>('conv-1');
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const activeConversation = conversations.find(c => c.id === selectedConversation);

  const filteredConversations = searchQuery.trim()
    ? conversations.filter(c =>
        c.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.role.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  useEffect(() => {
    messageInputRef.current?.focus();
  }, [selectedConversation]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const msg: Message = {
      id: `m-${Date.now()}`,
      senderId: 'me',
      senderName: 'You',
      content: newMessage.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: true,
    };

    setConversations(prev =>
      prev.map(c =>
        c.id === selectedConversation
          ? { ...c, messages: [...c.messages, msg], lastMessage: newMessage.trim(), lastMessageTime: 'Just now' }
          : c
      )
    );
    setNewMessage('');

    // Mock reply
    setTimeout(() => {
      const replies = [
        'Thank you for the message. I will look into it.',
        'Noted. I will get back to you shortly.',
        'Got it! I will take the necessary action.',
        'Thanks for the update. Much appreciated!',
        'Understood. Let me check and revert.',
      ];
      const reply: Message = {
        id: `m-reply-${Date.now()}`,
        senderId: activeConversation?.participantId || '',
        senderName: activeConversation?.participantName || '',
        content: replies[Math.floor(Math.random() * replies.length)],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRead: false,
      };

      setConversations(prev =>
        prev.map(c =>
          c.id === selectedConversation
            ? { ...c, messages: [...c.messages, reply], lastMessage: reply.content, lastMessageTime: 'Just now', unreadCount: c.id === selectedConversation ? 0 : c.unreadCount + 1 }
            : c
        )
      );
    }, 2000);
  };

  const handleNewConversation = () => {
    toast.info('New conversation feature - select a contact from the directory');
  };

  const handleAttachment = () => {
    toast.info('File sharing coming soon');
  };

  const selectConversation = (id: string) => {
    setSelectedConversation(id);
    setConversations(prev =>
      prev.map(c => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
  };

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <MessageSquare className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Messages</h2>
            <p className="text-sm text-gray-500">
              {totalUnread > 0 ? `${totalUnread} unread messages` : 'All caught up!'}
            </p>
          </div>
        </div>
        <Button onClick={handleNewConversation} className="gap-2">
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] lg:grid-cols-[360px_1fr]" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
          {/* Conversation List */}
          <div className="border-r flex flex-col">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2">
                {filteredConversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left mb-1 ${
                      selectedConversation === conv.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className={selectedConversation === conv.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}>
                          {conv.avatar}
                        </AvatarFallback>
                      </Avatar>
                      {conv.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{conv.participantName}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{conv.lastMessageTime}</span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{conv.role}</p>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-gray-500 truncate flex-1">{conv.lastMessage}</p>
                        {conv.unreadCount > 0 && (
                          <Badge className="bg-blue-500 text-white text-[10px] h-5 min-w-5 px-1.5 rounded-full flex-shrink-0 ml-2">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Message Thread */}
          {activeConversation ? (
            <div className="flex flex-col">
              {/* Header */}
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gray-100 text-gray-600">
                        {activeConversation.avatar}
                      </AvatarFallback>
                    </Avatar>
                    {activeConversation.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{activeConversation.participantName}</p>
                    <p className="text-xs text-gray-400">{activeConversation.role}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {activeConversation.messages.map(msg => {
                    const isOwn = msg.senderId === 'me';
                    return (
                      <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] ${isOwn ? 'order-2' : ''}`}>
                          <div
                            className={`px-4 py-2.5 rounded-2xl text-sm ${
                              isOwn
                                ? 'bg-emerald-500 text-white rounded-br-md'
                                : 'bg-gray-100 text-gray-800 rounded-bl-md'
                            }`}
                          >
                            {msg.content}
                          </div>
                          <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                            <span className="text-[10px] text-gray-400">{msg.timestamp}</span>
                            {isOwn && (
                              msg.isRead
                                ? <CheckCheck className="h-3 w-3 text-blue-400" />
                                : <Check className="h-3 w-3 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-3 border-t">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={handleAttachment}>
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    ref={messageInputRef}
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1"
                  />
                  <Button onClick={handleSendMessage} disabled={!newMessage.trim()} size="icon" className="h-9 w-9 flex-shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400">Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
