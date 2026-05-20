import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../lib/api';
import { formatIndiaDate } from '../lib/format';

// Mapping IDs from your database emotion column to actual emojis
const MOOD_CONFIG = {
    angry: '😠',
    confused: '🤔',
    Anxiety: '😰',
    sad: '😢',
    stress: '😫',
    Gratitude: '😊',
    happy: '😊',   // Fallback
    neutral: '😐', // Fallback
    romantic: '💖' // Fallback
};

export default function MoodCalendar() {
    const { user, isAuthenticated } = useAuth0();
    const navigate = useNavigate();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [moods, setMoods] = useState([]); 
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isAuthenticated && user?.email) {
            fetchMonthlyMoods();
        }
    }, [currentDate, isAuthenticated, user]);

    const fetchMonthlyMoods = async () => {
        setLoading(true);
        try {
            const res = await fetch(apiUrl("/get_monthly_moods.php"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: user.email,
                    month: String(currentDate.getMonth() + 1).padStart(2, '0'), // PHP expects 01-12
                    year: currentDate.getFullYear()
                })
            });
            const data = await res.json();
            if (data.status === "success") {
                setMoods(data.data || []);
            }
        } catch (err) {
            console.error("Error fetching moods:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDateClick = (dateStr) => {
        // Redirects to your notes page filtered by that specific day
        navigate(`/notes?date=${dateStr}`);
    };

    // Calendar Calculations
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: firstDay }, (_, i) => i);

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-stone-100 overflow-hidden">
                
                {/* Header Section */}
                <div className="bg-gradient-to-r from-orange-50 to-rose-50 p-6 sm:p-8 border-b border-stone-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-black text-stone-800 flex items-center gap-2">
                                <CalendarIcon className="text-orange-500" />
                                {formatIndiaDate(currentDate, { month: 'long' })}
                                <span className="text-stone-400 ml-1">{year}</span>
                            </h2>
                            <p className="text-sm text-stone-500 font-medium mt-1">Track your emotional journey</p>
                        </div>
                        
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setCurrentDate(new Date(year, month - 1))}
                                className="p-2.5 bg-white rounded-xl shadow-sm border border-stone-100 hover:bg-orange-500 hover:text-white transition-all"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => setCurrentDate(new Date(year, month + 1))}
                                className="p-2.5 bg-white rounded-xl shadow-sm border border-stone-100 hover:bg-orange-500 hover:text-white transition-all"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div className="p-6 sm:p-8 relative">
                    {loading && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                        </div>
                    )}

                    <div className="grid grid-cols-7 gap-2 sm:gap-4">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} className="text-[11px] font-black text-stone-300 text-center uppercase tracking-widest mb-2">
                                {d}
                            </div>
                        ))}

                        {blanks.map(b => <div key={`b-${b}`} className="h-16 sm:h-24" />)}

                        {days.map(day => {
                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            
                            // Find mood entries for this specific date
                            const dayMoods = moods.filter(m => m.entry_date === dateStr);

                            return (
                                <div 
                                    key={day} 
                                    onClick={() => handleDateClick(dateStr)}
                                    className={`group h-16 sm:h-24 border rounded-2xl flex flex-col items-center justify-center relative transition-all duration-300
                                        ${dayMoods.length > 0 
                                            ? 'bg-gradient-to-br from-white to-orange-50/40 border-orange-200 cursor-pointer hover:shadow-lg hover:-translate-y-1' 
                                            : 'border-stone-50 bg-stone-50/30'}`}
                                >
                                    <span className={`text-[10px] font-black absolute top-2 right-2 
                                        ${dayMoods.length > 0 ? 'text-orange-500' : 'text-stone-300'}`}>
                                        {day}
                                    </span>

                                    {/* Emotion Emojis */}
                                    <div className="flex flex-wrap justify-center gap-1 px-1">
                                        {dayMoods.slice(0, 3).map((m, idx) => (
                                            <span 
                                                key={idx} 
                                                className={`transition-transform group-hover:scale-110 
                                                    ${dayMoods.length > 1 ? 'text-sm' : 'text-3xl sm:text-4xl'}`}
                                                title={m.emotion}
                                            >
                                                {MOOD_CONFIG[m.emotion] || '📝'}
                                            </span>
                                        ))}
                                        {dayMoods.length > 3 && (
                                            <div className="bg-stone-800 text-white text-[8px] px-1 rounded-full">
                                                +{dayMoods.length - 3}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Legend / Key */}
            <div className="mt-8 flex flex-wrap justify-center gap-4">
                {Object.entries(MOOD_CONFIG).slice(0, 6).map(([key, emoji]) => (
                    <div key={key} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-stone-100 shadow-sm text-xs font-bold text-stone-600">
                        <span>{emoji}</span>
                        <span className="capitalize">{key}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
