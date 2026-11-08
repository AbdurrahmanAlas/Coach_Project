// Sınav Filtreleme Sistemi - Dropdown'ları Yönetme

document.addEventListener('DOMContentLoaded', function() {
  // Öğrenci mi koç mu kontrol et
  const isCoach = !window.location.hash.includes('question-platform');

  if (!isCoach) return; // Sadece koçlara göster

  // Filtreleme dropdown'ları
  const examSelect = document.getElementById('question-exam-filter');
  const subjectSelect = document.getElementById('question-subject-filter');
  const topicSelect = document.getElementById('question-topic-filter');

  // Soru formu dropdown'ları
  const examFormSelect = document.getElementById('question-exam-form');
  const subjectFormSelect = document.getElementById('question-subject-form');
  const topicFormSelect = document.getElementById('question-topic-form');

  // Her iki set olmalı
  if (!examSelect || !subjectSelect || !topicSelect) return;

  // Sınav türlerini doldur (hem filtreleme hem form)
  function populateExams() {
    const exams = getExamTypes();
    exams.forEach(exam => {
      // Filtreleme dropdown'u
      const option1 = document.createElement('option');
      option1.value = exam.code;
      option1.textContent = exam.name;
      examSelect.appendChild(option1);

      // Form dropdown'u (varsa)
      if (examFormSelect) {
        const option2 = document.createElement('option');
        option2.value = exam.code;
        option2.textContent = exam.name;
        examFormSelect.appendChild(option2);
      }
    });
  }

  // Dersleri doldur (hem filtreleme hem form)
  function populateSubjects(examType) {
    // Önceki seçenekleri temizle
    subjectSelect.innerHTML = '<option value="">Tümü</option>';
    topicSelect.innerHTML = '<option value="">Tümü</option>';

    if (subjectFormSelect) {
      subjectFormSelect.innerHTML = '<option value="">-- Sınav türü seç --</option>';
    }
    if (topicFormSelect) {
      topicFormSelect.innerHTML = '<option value="">-- Ders seç --</option>';
    }

    if (!examType) return;

    const subjects = getSubjectsByExam(examType);
    subjects.forEach(subject => {
      // Filtreleme dropdown'u
      const option1 = document.createElement('option');
      option1.value = subject.code;
      option1.textContent = subject.name;
      subjectSelect.appendChild(option1);

      // Form dropdown'u (varsa)
      if (subjectFormSelect) {
        const option2 = document.createElement('option');
        option2.value = subject.code;
        option2.textContent = subject.name;
        subjectFormSelect.appendChild(option2);
      }
    });
  }

  // Konuları doldur (hem filtreleme hem form)
  function populateTopics(examType, subject) {
    topicSelect.innerHTML = '<option value="">Tümü</option>';

    if (topicFormSelect) {
      topicFormSelect.innerHTML = '<option value="">-- Ders seç --</option>';
    }

    if (!examType || !subject) return;

    const topics = getTopicsByExamAndSubject(examType, subject);
    topics.forEach(topic => {
      // Filtreleme dropdown'u
      const option1 = document.createElement('option');
      option1.value = topic;
      option1.textContent = topic;
      topicSelect.appendChild(option1);

      // Form dropdown'u (varsa)
      if (topicFormSelect) {
        const option2 = document.createElement('option');
        option2.value = topic;
        option2.textContent = topic;
        topicFormSelect.appendChild(option2);
      }
    });
  }

  // Event listeners - Filtreleme dropdown'ları
  examSelect.addEventListener('change', function() {
    populateSubjects(this.value);
  });

  subjectSelect.addEventListener('change', function() {
    populateTopics(examSelect.value, this.value);
  });

  // Event listeners - Soru formu dropdown'ları (varsa)
  if (examFormSelect) {
    examFormSelect.addEventListener('change', function() {
      populateSubjects(this.value);
    });
  }

  if (subjectFormSelect) {
    subjectFormSelect.addEventListener('change', function() {
      populateTopics(examFormSelect.value, this.value);
    });
  }

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
