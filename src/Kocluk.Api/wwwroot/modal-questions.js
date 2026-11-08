// Professional Modal System - Soru Yönetimi
// Tüm projede kullanılan unified modal system

class QuestionModal {
  constructor() {
    this.isOpen = false;
    this.examType = '';
    this.subject = '';
    this.topic = '';
    this.onSubmit = null;
  }

  // Modal'ı aç
  open(onSubmit, prefillData = {}) {
    this.onSubmit = onSubmit;

    const backdrop = document.getElementById('question-modal-backdrop');
    const modal = document.getElementById('question-modal');

    if (!backdrop || !modal) {
      console.warn('Modal elements not found');
      return;
    }

    // Önceki verileri temizle
    this.resetForm();

    // Prefill data varsa ekle
    if (prefillData.examType) {
      document.getElementById('q-exam').value = prefillData.examType;
      this.examType = prefillData.examType;
      this.populateSubjects(prefillData.examType);

      if (prefillData.subject) {
        document.getElementById('q-subject').value = prefillData.subject;
        this.subject = prefillData.subject;
        this.populateTopics(prefillData.examType, prefillData.subject);

        if (prefillData.topic) {
          document.getElementById('q-topic').value = prefillData.topic;
          this.topic = prefillData.topic;
        }
      }
    }

    backdrop.style.display = 'grid';
    modal.style.display = 'block';
    this.isOpen = true;

    document.body.style.overflow = 'hidden';
    document.getElementById('q-prompt').focus();
  }

  // Modal'ı kapat
  close() {
    const backdrop = document.getElementById('question-modal-backdrop');
    const modal = document.getElementById('question-modal');

    if (backdrop) backdrop.style.display = 'none';
    if (modal) modal.style.display = 'none';

    this.isOpen = false;
    document.body.style.overflow = '';
    this.resetForm();
  }

  // Form'u temizle
  resetForm() {
    const form = document.getElementById('q-form');
    if (form) form.reset();

    document.getElementById('q-subject').innerHTML = '<option value="">Sınav türü seç</option>';
    document.getElementById('q-topic').innerHTML = '<option value="">Ders seç</option>';
    document.getElementById('q-status').innerHTML = '';
    document.getElementById('q-status').classList.add('hidden');
  }

  // Dersleri populate et
  populateSubjects(examType) {
    const select = document.getElementById('q-subject');
    select.innerHTML = '<option value="">Ders seç</option>';

    if (!examType || typeof getSubjectsByExam !== 'function') return;

    const subjects = getSubjectsByExam(examType);
    subjects.forEach(subject => {
      const option = document.createElement('option');
      option.value = subject.code;
      option.textContent = subject.name;
      select.appendChild(option);
    });
  }

  // Konuları populate et
  populateTopics(examType, subject) {
    const select = document.getElementById('q-topic');
    select.innerHTML = '<option value="">Konu seç</option>';

    if (!examType || !subject || typeof getTopicsByExamAndSubject !== 'function') return;

    const topics = getTopicsByExamAndSubject(examType, subject);
    topics.forEach(topic => {
      const option = document.createElement('option');
      option.value = topic;
      option.textContent = topic;
      select.appendChild(option);
    });
  }

  // Initialize - Dropdown event listener'ları ekle
  init() {
    const examSelect = document.getElementById('q-exam');
    const subjectSelect = document.getElementById('q-subject');
    const topicSelect = document.getElementById('q-topic');
    const closeBtn = document.getElementById('q-close');
    const backdrop = document.getElementById('question-modal-backdrop');
    const cancelBtn = document.getElementById('q-cancel');
    const submitBtn = document.getElementById('q-submit');
    const form = document.getElementById('q-form');

    if (examSelect) {
      examSelect.addEventListener('change', (e) => {
        this.examType = e.target.value;
        this.populateSubjects(e.target.value);
        topicSelect.innerHTML = '<option value="">Ders seç</option>';
      });
    }

    if (subjectSelect) {
      subjectSelect.addEventListener('change', (e) => {
        this.subject = e.target.value;
        this.populateTopics(this.examType, e.target.value);
      });
    }

    if (topicSelect) {
      topicSelect.addEventListener('change', (e) => {
        this.topic = e.target.value;
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.close());
    if (backdrop) backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.close();
    });

    if (submitBtn) {
      submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.submit();
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.submit();
      });
    }

    // Sınav türlerini initial populate et
    if (examSelect && typeof getExamTypes === 'function') {
      const exams = getExamTypes();
      exams.forEach(exam => {
        const option = document.createElement('option');
        option.value = exam.code;
        option.textContent = exam.name;
        examSelect.appendChild(option);
      });
    }
  }

  // Form'u submit et
  async submit() {
    const examType = document.getElementById('q-exam').value.trim();
    const subject = document.getElementById('q-subject').value.trim();
    const topic = document.getElementById('q-topic').value.trim();
    const prompt = document.getElementById('q-prompt').value.trim();
    const answer = document.getElementById('q-answer').value.trim();
    const explanation = document.getElementById('q-explanation').value.trim();
    const difficulty = document.getElementById('q-difficulty').value;
    const type = document.getElementById('q-type')?.value || 'ShortAnswer';
    const optionsJson = document.getElementById('q-options')?.value.trim() || null;
    const published = document.getElementById('q-published')?.checked || false;

    const status = document.getElementById('q-status');

    // Validasyon
    if (!examType || !subject || !topic || !prompt || !answer) {
      status.textContent = '❌ Lütfen tüm zorunlu alanları doldurun (Sınav türü, Ders, Konu, Soru, Cevap)';
      status.className = 'q-status-error';
      status.classList.remove('hidden');
      return;
    }

    status.textContent = '⏳ Kaydediliyor...';
    status.className = 'q-status-info';
    status.classList.remove('hidden');

    // Custom submit handler varsa kullan
    if (this.onSubmit && typeof this.onSubmit === 'function') {
      const result = await this.onSubmit({
        examType,
        subject,
        topic,
        prompt,
        answer: answer || null,
        explanation: explanation || null,
        difficulty,
        questionType: type,
        optionsJson,
        isPublished: published,
        points: 1
      });

      if (result.success) {
        status.textContent = '✅ Soru kaydedildi!';
        status.className = 'q-status-success';
        setTimeout(() => {
          this.close();
          if (result.callback) result.callback();
        }, 1500);
      } else {
        status.textContent = '❌ ' + (result.error || 'Soru kaydedilemedi');
        status.className = 'q-status-error';
      }
    }
  }
}

// Global instance
window.questionModal = new QuestionModal();
