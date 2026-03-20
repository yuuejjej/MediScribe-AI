import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Download, 
  Trash2, 
  AlertCircle,
  Loader2,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Languages,
  Stethoscope
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { generateMedicalArticle, reviewArticle, generateArticleImage, type Article } from './services/geminiService';
import { cn } from './lib/utils';

export default function App() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [topic, setTopic] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'ready' | 'processing'>('all');
  const [isSelectingImage, setIsSelectingImage] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('mediscribe_articles');
    if (saved) {
      try {
        setArticles(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved articles", e);
      }
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('mediscribe_articles', JSON.stringify(articles));
  }, [articles]);

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    setIsGenerating(true);
    const newId = Math.random().toString(36).substr(2, 9);
    
    const placeholder: Article = {
      id: newId,
      topic,
      title: 'جاري التوليد...',
      content: '',
      seoKeywords: [],
      metaDescription: '',
      sources: [],
      imageUrl: '',
      status: 'generating',
      wordCount: 0,
      createdAt: new Date().toISOString(),
    };

    setArticles(prev => [placeholder, ...prev]);
    setTopic('');

    try {
      // Step 1: Generate
      const generated = await generateMedicalArticle(topic);
      setArticles(prev => prev.map(a => a.id === newId ? { ...a, ...generated, status: 'reviewing' } : a));

      // Step 2: Review
      const reviewed = await reviewArticle(generated);
      setArticles(prev => prev.map(a => a.id === newId ? { ...a, ...reviewed, status: 'ready' } : a));
      
    } catch (error) {
      console.error("Generation failed", error);
      setArticles(prev => prev.filter(a => a.id !== newId));
      alert("حدث خطأ أثناء توليد المقال. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteArticle = (id: string) => {
    setArticles(prev => prev.filter(a => a.id !== id));
    if (selectedArticle?.id === id) setSelectedArticle(null);
  };

  const downloadArticle = (article: Article, format: 'json' | 'txt' = 'json') => {
    let content = '';
    let mimeType = '';
    let extension = '';

    if (format === 'json') {
      content = JSON.stringify(article, null, 2);
      mimeType = 'application/json';
      extension = 'json';
    } else {
      content = `
العنوان: ${article.title}
الموضوع: ${article.topic}
التاريخ: ${new Date(article.createdAt).toLocaleString('ar-EG')}
عدد الكلمات: ${article.wordCount}

وصف Meta:
${article.metaDescription}

الكلمات المفتاحية:
${article.seoKeywords.join(', ')}

رابط الصورة:
${article.imageUrl}

المحتوى:
${article.content}

المصادر:
${article.sources.join('\n')}

ملاحظات المراجعة:
${article.reviewNotes || 'لا توجد ملاحظات'}
      `.trim();
      mimeType = 'text/plain';
      extension = 'txt';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${article.title.replace(/\s+/g, '_')}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectImage = (articleId: string, imageUrl: string) => {
    setArticles(prev => prev.map(a => a.id === articleId ? { ...a, imageUrl } : a));
    if (selectedArticle?.id === articleId) {
      setSelectedArticle(prev => prev ? { ...prev, imageUrl } : null);
    }
    setIsSelectingImage(false);
  };

  const handleGenerateAIImage = async () => {
    if (!selectedArticle) return;
    
    setIsGeneratingImage(true);
    try {
      const imageUrl = await generateArticleImage(selectedArticle.topic);
      selectImage(selectedArticle.id, imageUrl);
    } catch (error) {
      console.error("AI Image generation failed", error);
      alert("فشل توليد الصورة بالذكاء الاصطناعي. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const filteredArticles = articles.filter(a => {
    // Status filter
    const matchesStatus = 
      activeTab === 'all' || 
      (activeTab === 'ready' && a.status === 'ready') || 
      (activeTab === 'processing' && a.status !== 'ready');

    // Search filter
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      !query || 
      a.topic.toLowerCase().includes(query) || 
      a.title.toLowerCase().includes(query) || 
      a.seoKeywords.some(kw => kw.toLowerCase().includes(query));

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-emerald-100" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <Stethoscope size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">MediScribe AI</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 font-medium">نظام توليد المقالات الطبية</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar: Controls & List */}
        <div className="lg:col-span-4 space-y-6">
          {/* Input Section */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">توليد مقال جديد</h2>
            <div className="relative">
              <input 
                type="text"
                placeholder="أدخل موضوع المقال (مثلاً: فوائد الصيام المتقطع)"
                className="w-full pl-4 pr-12 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                disabled={isGenerating}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                <Search size={20} />
              </div>
            </div>
            <button 
              onClick={handleGenerate}
              disabled={isGenerating || !topic.trim()}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-100"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  جاري التوليد...
                </>
              ) : (
                <>
                  <Plus size={20} />
                  توليد المقال
                </>
              )}
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex p-1 bg-gray-100 rounded-xl">
            {(['all', 'ready', 'processing'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                  activeTab === tab ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {tab === 'all' ? 'الكل' : tab === 'ready' ? 'جاهز' : 'قيد التنفيذ'}
              </button>
            ))}
          </div>

          {/* Search Input for Filtering */}
          <div className="relative">
            <input 
              type="text"
              placeholder="البحث في المقالات (الموضوع، الكلمات...)"
              className="w-full pl-4 pr-10 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Search size={16} />
            </div>
          </div>

          {/* Article List */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {filteredArticles.map((article) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={article.id}
                  onClick={() => setSelectedArticle(article)}
                  className={cn(
                    "p-4 rounded-xl border cursor-pointer transition-all group",
                    selectedArticle?.id === article.id 
                      ? "bg-emerald-50 border-emerald-200 shadow-sm" 
                      : "bg-white border-gray-100 hover:border-emerald-100 hover:shadow-sm"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                      article.status === 'ready' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {article.status === 'ready' ? 'جاهز للنشر' : article.status === 'reviewing' ? 'قيد المراجعة' : 'جاري التوليد'}
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {new Date(article.createdAt).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 line-clamp-1 mb-1">{article.title}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2">{article.topic}</p>
                  
                  <div className="mt-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); downloadArticle(article); }}
                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <Download size={16} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteArticle(article.id); }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <ChevronRight size={16} className="text-gray-300" />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {filteredArticles.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <FileText size={48} className="mx-auto mb-4 opacity-20" />
                <p>لا توجد مقالات حالياً</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Content: Article Detail */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {selectedArticle ? (
              <motion.div
                key={selectedArticle.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                {/* Article Header Image */}
                <div className="h-64 bg-gray-200 relative overflow-hidden group/header">
                  {selectedArticle.imageUrl ? (
                    <>
                      <img 
                        src={selectedArticle.imageUrl} 
                        alt={selectedArticle.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <button 
                        onClick={() => setIsSelectingImage(true)}
                        className="absolute top-4 left-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg backdrop-blur-sm opacity-0 group-hover/header:opacity-100 transition-opacity"
                      >
                        <ImageIcon size={18} />
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-100">
                      <ImageIcon size={48} className="mb-2 opacity-20" />
                      <button 
                        onClick={() => setIsSelectingImage(true)}
                        className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm"
                      >
                        اختيار صورة للمقال
                      </button>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                  <div className="absolute bottom-6 right-6 left-6 pointer-events-none">
                    <h2 className="text-3xl font-bold text-white mb-2">{selectedArticle.title}</h2>
                    <div className="flex items-center gap-4 text-white/80 text-sm">
                      <span className="flex items-center gap-1"><Clock size={14} /> {selectedArticle.wordCount} كلمة</span>
                      <span className="flex items-center gap-1"><Languages size={14} /> العربية</span>
                    </div>
                  </div>
                </div>

                {/* Image Selection Modal/Overlay */}
                <AnimatePresence>
                  {isSelectingImage && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-40 bg-white/95 backdrop-blur-sm p-8 overflow-y-auto"
                    >
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-900">اختر صورة للمقال</h3>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={handleGenerateAIImage}
                            disabled={isGeneratingImage}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:bg-gray-300 transition-all shadow-md"
                          >
                            {isGeneratingImage ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Plus size={16} />
                            )}
                            توليد صورة بالذكاء الاصطناعي
                          </button>
                          <button 
                            onClick={() => setIsSelectingImage(false)}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                          >
                            <Trash2 size={20} className="text-gray-400" />
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-500 mb-6">
                        اقتراحات بناءً على: <span className="font-mono text-emerald-600">{selectedArticle.imageSearchQuery}</span>
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {[0, 1, 2, 3, 4, 5].map((sig) => {
                          const url = `https://source.unsplash.com/featured/800x600?${encodeURIComponent(selectedArticle.imageSearchQuery || selectedArticle.topic)}&sig=${sig}`;
                          return (
                            <motion.div
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              key={sig}
                              onClick={() => selectImage(selectedArticle.id, url)}
                              className="aspect-video bg-gray-100 rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-emerald-500 transition-all relative group"
                            >
                              <img 
                                src={url} 
                                alt={`Suggestion ${sig}`}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-emerald-600/0 group-hover:bg-emerald-600/10 transition-colors" />
                            </motion.div>
                          );
                        })}
                      </div>
                      
                      <div className="mt-8 p-4 bg-gray-50 rounded-xl text-center">
                        <p className="text-xs text-gray-400">يتم جلب الصور من Unsplash بشكل عشوائي بناءً على كلمات البحث المقترحة.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Article Info Bar */}
                <div className="px-8 py-4 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex gap-2">
                    {selectedArticle.seoKeywords.map((kw, i) => (
                      <span key={i} className="px-2 py-1 bg-white border border-gray-200 rounded-md text-[10px] font-medium text-gray-600">
                        #{kw}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => downloadArticle(selectedArticle, 'txt')}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
                    >
                      <FileText size={16} /> تصدير TXT
                    </button>
                    <button 
                      onClick={() => downloadArticle(selectedArticle, 'json')}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
                    >
                      <Download size={16} /> حفظ JSON
                    </button>
                  </div>
                </div>

                {/* Article Content */}
                <div className="p-8">
                  {selectedArticle.status !== 'ready' ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                      <Loader2 size={48} className="text-emerald-500 animate-spin" />
                      <p className="text-gray-500 font-medium">
                        {selectedArticle.status === 'generating' ? 'جاري توليد المحتوى الطبي...' : 'جاري مراجعة الأخطاء الطبية واللغوية...'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                      {/* Main Content */}
                      <div className="md:col-span-8 prose prose-emerald max-w-none">
                        <div className="mb-8 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                          <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <CheckCircle2 size={14} /> ملاحظات المراجعة الطبية
                          </h4>
                          <p className="text-sm text-emerald-700 leading-relaxed">
                            {selectedArticle.reviewNotes || 'تمت مراجعة المقال للتأكد من الدقة الطبية واللغوية.'}
                          </p>
                        </div>
                        <ReactMarkdown>
                          {selectedArticle.content}
                        </ReactMarkdown>
                      </div>

                      {/* Sidebar Meta */}
                      <div className="md:col-span-4 space-y-6">
                        <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">وصف Meta (SEO)</h4>
                          <p className="text-sm text-gray-600 leading-relaxed italic">
                            "{selectedArticle.metaDescription}"
                          </p>
                        </div>

                        <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">المصادر الموثوقة</h4>
                          <ul className="space-y-3">
                            {selectedArticle.sources.map((source, i) => (
                              <li key={i} className="flex items-start gap-2 group">
                                <ExternalLink size={14} className="mt-1 text-emerald-500 shrink-0" />
                                <a 
                                  href={source} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-gray-600 hover:text-emerald-600 transition-colors line-clamp-2 break-all"
                                >
                                  {source}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100">
                          <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <AlertCircle size={14} /> تنبيه طبي
                          </h4>
                          <p className="text-[10px] text-amber-700 leading-relaxed">
                            هذا المحتوى تم توليده بواسطة الذكاء الاصطناعي لأغراض إعلامية فقط. لا يغني عن استشارة الطبيب المختص.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="h-full min-h-[600px] flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
                <FileText size={64} className="mb-4 opacity-10" />
                <p className="text-lg font-medium">اختر مقالاً من القائمة أو قم بتوليد واحد جديد</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-8 border-t border-gray-100 text-center text-gray-400 text-sm">
        <p>© 2026 MediScribe AI - جميع الحقوق محفوظة</p>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E5E7EB;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #D1D5DB;
        }
        
        .prose h2 { font-size: 1.5rem; font-weight: 700; margin-top: 2rem; margin-bottom: 1rem; color: #111827; }
        .prose h3 { font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.75rem; color: #374151; }
        .prose p { margin-bottom: 1.25rem; line-height: 1.8; color: #4B5563; }
        .prose ul { list-style-type: disc; padding-right: 1.5rem; margin-bottom: 1.25rem; }
        .prose li { margin-bottom: 0.5rem; color: #4B5563; }
      `}} />
    </div>
  );
}
