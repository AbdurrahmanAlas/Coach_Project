// Sınav Filtreleme Sistemi - Dropdown'ları Yönetme

document.addEventListener('DOMContentLoaded', function() {
  // Öğrenci mi koç mu kontrol et
  const isCoach = !window.location.hash.includes('question-platform');

  if (!isCoach) return; // Sadece koçlara göster

  const examSelect = document.getElementById('question-exam-filter');
  const subjectSelect = document.getElementById('question-subject-filter');
  const topicSelect = document.getElementById('question-topic-filter');

  if (!examSelect || !subjectSelect || !topicSelect) return;

  // Sınav türlerini doldur
  function populateExams() {
    const exams = getExamTypes();
    exams.forEach(exam => {
      const option = document.createElement('option');
      option.value = exam.code;
      option.textContent = exam.name;
      examSelect.appendChild(option);
    });
  }

  // Dersleri doldur
  function populateSubjects(examType) {
    // Önceki seçenekleri temizle
    subjectSelect.innerHTML = '<option value="">Tümü</option>';
    topicSelect.innerHTML = '<option value="">Tümü</option>';

    if (!examType) return;

    const subjects = getSubjectsByExam(examType);
    subjects.forEach(subject => {
      const option = document.createElement('option');
      option.value = subject.code;
      option.textContent = subject.name;
      subjectSelect.appendChild(option);
    });
  }

  // Konuları doldur
  function populateTopics(examType, subject) {
    topicSelect.innerHTML = '<option value="">Tümü</option>';

    if (!examType || !subject) return;

    const topics = getTopicsByExamAndSubject(examType, subject);
    topics.forEach(topic => {
      const option = document.createElement('option');
      option.value = topic;
      option.textContent = topic;
      topicSelect.appendChild(option);
    });
  }

  // Event listeners
  examSelect.addEventListener('change', function() {
    populateSubjects(this.value);
  });

  subjectSelect.addEventListener('change', function() {
    populateTopics(examSelect.value, this.value);
  });

  // İlk yükleme
  populateExams();

  // Sayfa yüklendiğinde API'den alınan soruları filtrele
  function filterQuestions() {
    const examType = examSelect.value;
    const subject = subjectSelect.value;
    const topic = topicSelect.value;
    const difficulty = document.getElementById('question-difficulty-filter').value;

    // API çağrısı veya lokal filtreleme
    // TODO: Backend'de sorgulamayı güncelleyelim
    console.log('Filtre:', { examType, subject, topic, difficulty });
  }

  // Dropdown değiştiğinde filtrele
  [examSelect, subjectSelect, topicSelect, document.getElementById('question-difficulty-filter')].forEach(select => {
    if (select) select.addEventListener('change', filterQuestions);
  });
});
