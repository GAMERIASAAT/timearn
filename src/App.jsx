import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Clock, 
  Briefcase, 
  Plus, 
  Trash2, 
  Calendar, 
  DollarSign,
  Play,
  BriefcaseBusiness,
  AlertCircle,
  FileBarChart,
  FileText,
  Copy,
  CheckCircle2,
  Share
} from 'lucide-react';

// --- Utility Functions ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const getLocalYYYYMMDD = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayString = () => getLocalYYYYMMDD();
const getFirstDayOfMonth = () => {
  const d = new Date();
  return getLocalYYYYMMDD(new Date(d.getFullYear(), d.getMonth(), 1));
};

const calculateHours = (startTime, endTime, breakMinutes) => {
  if (!startTime || !endTime) return 0;
  
  const start = new Date(`1970-01-01T${startTime}:00`);
  const end = new Date(`1970-01-01T${endTime}:00`);
  
  let diffMs = end - start;
  // Handle overnight shifts
  if (diffMs < 0) {
    diffMs += 24 * 60 * 60 * 1000;
  }
  
  const totalMinutes = Math.max(0, (diffMs / (1000 * 60)) - (parseInt(breakMinutes) || 0));
  return totalMinutes / 60;
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { 
    weekday: 'short', 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

const formatTimeWithPeriod = (timeStr) => {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  let h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12; 
  return `${h}:${minutes} ${ampm}`;
};

// --- Main Application Component ---
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // --- State: Modals ---
  const [jobToDelete, setJobToDelete] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportText, setExportText] = useState("");
  const [copied, setCopied] = useState(false);
  
  // --- State: Offline Storage Initialization ---
  const [jobs, setJobs] = useState(() => {
    const savedJobs = localStorage.getItem('timeearn_jobs');
    return savedJobs ? JSON.parse(savedJobs) : [];
  });
  
  const [entries, setEntries] = useState(() => {
    const savedEntries = localStorage.getItem('timeearn_entries');
    return savedEntries ? JSON.parse(savedEntries) : [];
  });

  // --- State: Reports ---
  const [reportParams, setReportParams] = useState({
    startDate: getFirstDayOfMonth(),
    endDate: getTodayString(),
    jobId: 'all'
  });

  // Top-level calculations for Report Tab
  const reportFilteredEntries = useMemo(() => {
    if (!reportParams.startDate || !reportParams.endDate) return [];
    
    return entries.filter(e => {
      const inDateRange = e.date >= reportParams.startDate && e.date <= reportParams.endDate;
      const isJobMatch = reportParams.jobId === 'all' || e.jobId === reportParams.jobId;
      return inDateRange && isJobMatch;
    });
  }, [entries, reportParams]);


  // --- Effects: Save to Offline Storage ---
  useEffect(() => {
    localStorage.setItem('timeearn_jobs', JSON.stringify(jobs));
  }, [jobs]);

  useEffect(() => {
    localStorage.setItem('timeearn_entries', JSON.stringify(entries));
  }, [entries]);


  // --- Handlers: Jobs ---
  const handleAddJob = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newJob = {
      id: generateId(),
      name: formData.get('jobName'),
      rate: parseFloat(formData.get('jobRate')),
      currency: 'USD'
    };
    setJobs([...jobs, newJob]);
    e.target.reset();
  };

  const confirmDeleteJob = () => {
    if (jobToDelete) {
      setJobs(jobs.filter(j => j.id !== jobToDelete));
      setJobToDelete(null);
    }
  };

  // --- Handlers: Entries ---
  const handleAddEntry = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const jobId = formData.get('jobId');
    const date = formData.get('date');
    const startTime = formData.get('startTime');
    const endTime = formData.get('endTime');
    const breakMins = parseInt(formData.get('breakMins')) || 0;

    const job = jobs.find(j => j.id === jobId);
    if (!job) return; // Silent return if form validation fails strangely

    const hours = calculateHours(startTime, endTime, breakMins);
    const earnings = hours * job.rate;

    const newEntry = {
      id: generateId(),
      jobId,
      date,
      startTime,
      endTime,
      breakMins,
      totalHours: hours,
      earnings: earnings
    };

    setEntries([newEntry, ...entries].sort((a, b) => {
      if (a.date !== b.date) return a.date > b.date ? -1 : 1;
      return a.startTime > b.startTime ? -1 : 1;
    }));
    
    e.target.reset();
    e.target.elements.date.value = date;
    e.target.elements.jobId.value = jobId;
    
    setActiveTab('dashboard');
  };

  const handleDeleteEntry = (entryId) => {
    setEntries(entries.filter(e => e.id !== entryId));
  };

  // --- Handlers: Export ---
  const generateExportText = () => {
    if (reportFilteredEntries.length === 0) return;

    let text = "";
    // Sort chronologically for reading (oldest first)
    const sorted = [...reportFilteredEntries].sort((a,b) => a.date > b.date ? 1 : -1);

    sorted.forEach(entry => {
      // Get exact local day name
      const [year, month, day] = entry.date.split('-');
      const localDate = new Date(year, month - 1, day);
      const dayName = localDate.toLocaleDateString('en-US', { weekday: 'long' });

      // Format time to remove :00 if on the exact hour
      const formatTimeExport = (t) => {
        const [hr, min] = t.split(':');
        return min === '00' ? parseInt(hr, 10).toString() : `${parseInt(hr, 10)}:${min}`;
      };

      text += `${dayName} ${formatTimeExport(entry.startTime)} to ${formatTimeExport(entry.endTime)}\n`;
    });

    const totalHours = reportFilteredEntries.reduce((sum, e) => sum + e.totalHours, 0);
    text += `\nTotal: ${totalHours.toFixed(2)} hours`;

    setExportText(text);
    setCopied(false);
    setShowExportModal(true);
  };

  const copyToClipboard = () => {
    const textArea = document.createElement("textarea");
    textArea.value = exportText;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
    document.body.removeChild(textArea);
  };


  // --- Views ---
  const renderDashboard = () => {
    const currentMonthPrefix = getTodayString().substring(0, 7);
    const currentMonthEntries = entries.filter(e => e.date.startsWith(currentMonthPrefix));

    const totalMonthHours = currentMonthEntries.reduce((sum, e) => sum + e.totalHours, 0);
    const totalMonthEarnings = currentMonthEntries.reduce((sum, e) => sum + e.earnings, 0);

    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-6">
        {/* Month Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
            <div className="flex items-center space-x-2 text-blue-600 mb-2">
              <Clock size={18} />
              <span className="text-xs font-semibold uppercase tracking-wider">Hours</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{totalMonthHours.toFixed(2)} <span className="text-sm font-normal text-gray-500">hrs</span></h3>
          </div>
          
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
            <div className="flex items-center space-x-2 text-green-600 mb-2">
              <DollarSign size={18} />
              <span className="text-xs font-semibold uppercase tracking-wider">Earned</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(totalMonthEarnings)}</h3>
          </div>
        </div>

        {/* Recent Entries List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Recent Logs</h3>
          </div>
          
          <div className="divide-y divide-gray-100">
            {entries.length === 0 ? (
              <div className="p-8 flex flex-col items-center justify-center text-gray-400">
                <Calendar size={48} className="mb-3 opacity-20" />
                <p className="text-sm text-center">No work entries yet.<br/>Go to Tracker to log hours.</p>
              </div>
            ) : (
              entries.slice(0, 10).map(entry => {
                const job = jobs.find(j => j.id === entry.jobId);
                return (
                  <div key={entry.id} className="p-4 flex flex-col active:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-bold text-gray-900 text-base">{job ? job.name : 'Unknown Job'}</p>
                      <span className="text-green-600 font-bold text-base">{formatCurrency(entry.earnings)}</span>
                    </div>
                    <div className="flex justify-between items-end text-sm text-gray-500">
                      <div>
                        <p>{formatDate(entry.date)}</p>
                        <p className="text-xs mt-0.5">{formatTimeWithPeriod(entry.startTime)} - {formatTimeWithPeriod(entry.endTime)}</p>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md text-xs mb-1">
                          {entry.totalHours.toFixed(2)} hrs
                        </span>
                        <button 
                          onClick={() => handleDeleteEntry(entry.id)} 
                          className="text-gray-300 hover:text-red-500 p-1 -mr-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTracker = () => {
    if (jobs.length === 0) {
      return (
        <div className="bg-orange-50 text-orange-800 p-4 rounded-2xl flex items-start space-x-3 border border-orange-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <AlertCircle className="shrink-0 mt-0.5" size={20} />
          <p className="text-sm">You need to create a Job first. Tap the <strong>Jobs</strong> tab below to add one.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Log Work Time</h2>
          
          <form onSubmit={handleAddEntry} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Select Job</label>
              <select name="jobId" required className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none text-base">
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>{job.name} ({formatCurrency(job.rate)}/hr)</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Date</label>
              <input type="date" name="date" required defaultValue={getTodayString()} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Start Time</label>
                <input type="time" name="startTime" required className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">End Time</label>
                <input type="time" name="endTime" required className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Unpaid Break (Minutes)</label>
              <input type="number" name="breakMins" defaultValue="0" min="0" placeholder="e.g. 30" className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base" />
            </div>

            <div className="pt-2">
              <button type="submit" className="w-full flex items-center justify-center space-x-2 bg-blue-600 active:bg-blue-700 text-white p-4 rounded-xl transition-colors font-bold text-lg shadow-md shadow-blue-600/20">
                <Play fill="currentColor" size={20} />
                <span>Save Entry</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderReports = () => {
    const totalHours = reportFilteredEntries.reduce((sum, e) => sum + e.totalHours, 0);
    const totalEarnings = reportFilteredEntries.reduce((sum, e) => sum + e.earnings, 0);

    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-6">
        
        {/* Filter Form */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Custom Report</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Filter by Job</label>
              <select 
                value={reportParams.jobId} 
                onChange={(e) => setReportParams({...reportParams, jobId: e.target.value})}
                className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none text-base"
              >
                <option value="all">All Jobs Combined</option>
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>{job.name}</option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Start Date</label>
                <input 
                  type="date" 
                  value={reportParams.startDate}
                  onChange={(e) => setReportParams({...reportParams, startDate: e.target.value})}
                  className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">End Date</label>
                <input 
                  type="date" 
                  value={reportParams.endDate}
                  onChange={(e) => setReportParams({...reportParams, endDate: e.target.value})}
                  className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results Cards */}
        <div className="bg-blue-600 p-6 rounded-2xl shadow-md text-white flex flex-col items-center justify-center text-center">
          <h4 className="text-blue-100 font-medium mb-1 text-sm uppercase tracking-wide">Total Hours</h4>
          <h2 className="text-4xl font-bold tracking-tight mb-4">{totalHours.toFixed(2)} <span className="text-xl text-blue-300 font-normal">hrs</span></h2>
          
          <div className="w-full border-t border-blue-500/50 pt-4 mt-2">
            <h4 className="text-blue-100 font-medium mb-1 text-sm uppercase tracking-wide">Total Earnings</h4>
            <h2 className="text-3xl font-bold tracking-tight">{formatCurrency(totalEarnings)}</h2>
          </div>
        </div>

        {/* Export Button & List Breakdown */}
        <div className="pt-2">
          <div className="flex justify-between items-center mb-3 px-1">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
              Logs in Report ({reportFilteredEntries.length})
            </h3>
            {reportFilteredEntries.length > 0 && (
              <button 
                onClick={generateExportText}
                className="flex items-center space-x-1.5 text-blue-600 font-bold text-sm bg-blue-50 px-3 py-1.5 rounded-lg active:bg-blue-100 transition-colors"
              >
                <Share size={16} />
                <span>Export Text</span>
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {reportFilteredEntries.length === 0 ? (
              <div className="text-center py-6 bg-white rounded-2xl border border-gray-200 border-dashed text-gray-400">
                <p className="text-sm">No work entries match this date range.</p>
              </div>
            ) : (
              reportFilteredEntries.map(entry => {
                const job = jobs.find(j => j.id === entry.jobId);
                return (
                  <div key={entry.id} className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-bold text-gray-900 text-sm">{job ? job.name : 'Unknown Job'}</p>
                      <span className="text-green-600 font-bold text-sm">{formatCurrency(entry.earnings)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>{formatDate(entry.date)}</span>
                      <span className="font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md">
                        {entry.totalHours.toFixed(2)} hrs
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderJobs = () => {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-6">
        
        {/* Add Job Form */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Add New Job</h2>
          <form onSubmit={handleAddJob} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Job / Client Name</label>
              <input type="text" name="jobName" required placeholder="e.g. Delivery, Freelance..." className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Hourly Rate ($)</label>
              <input type="number" name="jobRate" required min="0" step="0.01" placeholder="0.00" className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base" />
            </div>
            <button type="submit" className="w-full flex items-center justify-center space-x-2 bg-gray-900 active:bg-black text-white p-3.5 rounded-xl transition-colors font-bold text-base shadow-md">
              <Plus size={20} />
              <span>Create Job</span>
            </button>
          </form>
        </div>

        {/* Existing Jobs List */}
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide px-1 pt-2">Your Jobs</h3>
        <div className="space-y-3">
          {jobs.length === 0 && (
            <div className="text-center py-8 bg-white rounded-2xl border border-gray-200 border-dashed text-gray-400">
              <BriefcaseBusiness size={40} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">No jobs added yet.</p>
            </div>
          )}
          {jobs.map(job => (
            <div key={job.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
              <div className="flex justify-between items-start pl-2">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg mb-1">{job.name}</h3>
                  <p className="text-gray-500 text-sm">Rate: <span className="font-bold text-gray-800">{formatCurrency(job.rate)}</span>/hr</p>
                </div>
                <button onClick={() => setJobToDelete(job.id)} className="p-2 text-gray-400 hover:text-red-500 active:bg-red-50 rounded-full transition-colors">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // --- Navigation Config ---
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tracker', label: 'Tracker', icon: Clock },
    { id: 'reports', label: 'Reports', icon: FileBarChart },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
  ];

  return (
    // The h-[100dvh] + overflow-hidden prevents the overall body from scrolling.
    <div className="h-[100dvh] bg-gray-100 flex flex-col text-gray-900 font-sans selection:bg-blue-200 overflow-hidden relative">
      
      {/* Top App Bar - NOW INCLUDES SAFE-AREA INSET FIX */}
      <header 
        className="bg-blue-600 text-white px-4 pb-4 shadow-md z-20 flex items-center justify-between shrink-0"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center space-x-3">
          <Clock size={24} className="opacity-90" />
          <h1 className="text-xl font-bold tracking-wide">TimeEarn</h1>
        </div>
      </header>

      {/* Main Content Area - Scroll is explicitly isolated to this tag */}
      <main className="flex-1 overflow-y-auto w-full relative z-10 p-4">
        <div className="max-w-md mx-auto pb-24">
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'tracker' && renderTracker()}
          {activeTab === 'reports' && renderReports()}
          {activeTab === 'jobs' && renderJobs()}
        </div>
      </main>

      {/* Bottom Navigation - NOW INCLUDES SAFE-AREA INSET FIX for Bottom Nav Gestures */}
      <nav 
        className="absolute bottom-0 w-full bg-white border-t border-gray-200 flex justify-around items-center px-1 pt-2 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex flex-col items-center justify-center w-full py-1 relative"
            >
              <div className={`px-4 py-1.5 rounded-full transition-all duration-200 ${isActive ? 'bg-blue-100 scale-110' : 'bg-transparent'}`}>
                <item.icon size={22} className={isActive ? 'text-blue-700' : 'text-gray-500'} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] mt-1.5 font-bold transition-colors ${isActive ? 'text-blue-800' : 'text-gray-500'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Text Export Modal */}
      {showExportModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white p-5 rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <h3 className="text-xl font-bold mb-3 flex items-center text-gray-900">
              <FileText className="mr-2 text-blue-600" size={24} />
              Export Data
            </h3>
            <p className="text-sm text-gray-500 mb-3">Your filtered work log, ready to paste into an invoice or message.</p>
            <textarea
              readOnly
              className="w-full flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm mb-4 resize-none min-h-[160px] outline-none"
              value={exportText}
            />
            <div className="flex justify-end space-x-3 shrink-0">
              <button 
                onClick={() => setShowExportModal(false)} 
                className="px-4 py-2.5 text-gray-700 active:bg-gray-100 rounded-xl font-bold text-sm transition-colors"
              >
                Close
              </button>
              <button 
                onClick={copyToClipboard} 
                className="px-5 py-2.5 bg-blue-600 active:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center space-x-2"
              >
                {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                <span>{copied ? 'Copied!' : 'Copy Text'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Job Confirmation Modal */}
      {jobToDelete && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-3 flex items-center text-red-600">
              <AlertCircle className="mr-2" size={24} />
              Delete Job?
            </h3>
            <p className="text-gray-600 mb-6 text-sm leading-relaxed">
              Are you sure you want to remove this job? Your previously logged hours will be saved, but they will show up as "Unknown Job".
            </p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setJobToDelete(null)} 
                className="px-5 py-2.5 text-gray-700 active:bg-gray-100 rounded-xl font-bold text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteJob} 
                className="px-5 py-2.5 bg-red-600 active:bg-red-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm shadow-red-600/30"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

