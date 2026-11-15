// Global curriculum loader - tüm sayfalar ve modallar tarafından kullanılır
window.CurriculumManager = (() => {
  let curriculumCache = null;
  let loadingPromise = null;

  async function loadFromAPI() {
    if (curriculumCache) return curriculumCache;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      try {
        const exams = await fetch('/api/curriculum/exams').then(r => r.json());
        const curriculum = { exams: {}, subjects: {}, topics: {} };

        if (!Array.isArray(exams)) throw new Error('Sınavlar yüklenemedi');

        for (const exam of exams) {
          curriculum.exams[exam.id] = exam;
          try {
            const subjs = await fetch('/api/curriculum/exams/' + exam.id + '/subjects').then(r => r.json());
            if (Array.isArray(subjs)) {
              for (const subj of subjs) {
                curriculum.subjects[subj.id] = { ...subj, examId: exam.id };
                try {
                  const tops = await fetch('/api/curriculum/subjects/' + subj.id + '/topics').then(r => r.json());
                  if (Array.isArray(tops)) curriculum.topics[subj.id] = tops;
                } catch (e) { console.warn('Konular yüklenemedi:', subj.id); }
              }
            }
          } catch (e) { console.warn('Dersler yüklenemedi:', exam.id); }
        }

        curriculumCache = curriculum;
        return curriculum;
      } catch (e) {
        console.error('Müfredat yüklenemedi:', e);
        return { exams: {}, subjects: {}, topics: {} };
      }
    })();

    return loadingPromise;
  }

  return {
    async load() { return loadFromAPI(); },
    async getExams() { const c = await loadFromAPI(); return Object.values(c.exams); },
    async getSubjectsByExam(examId) { const c = await loadFromAPI(); return Object.values(c.subjects).filter(s => s.examId === examId); },
    async getTopicsBySubject(subjectId) { const c = await loadFromAPI(); return c.topics[subjectId] || []; }
  };
})();

// Backward compatibility: exam-data.js replacements
window.getExamTypes = async function() { const exams = await CurriculumManager.getExams(); return exams.map(e => ({ code: e.id, name: e.name })); };
window.getSubjectsByExam = async function(examId) { const subjs = await CurriculumManager.getSubjectsByExam(examId); return subjs.map(s => ({ code: s.id, name: s.name })); };
window.getTopicsByExamAndSubject = async function(examId, subjectId) { const topics = await CurriculumManager.getTopicsBySubject(subjectId); return topics.map(t => t.name); };
