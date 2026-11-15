// Professional Modal System - Çalışma Gönder (Send Assignment/Worksheet)

class WorksheetModal {
  constructor() {
    this.isOpen = false;
    this.examType = '';
    this.subject = '';
    this.topic = '';
    this.studentId = '';
    this.onSubmit = null;
  }

  // Modal'ı aç
  open(onSubmit, prefillData = {}, tenantId = null) {
    this.onSubmit = onSubmit;

    const backdrop = document.getElementById('worksheet-modal-backdrop');
    const modal = document.getElementById('worksheet-modal');

    if (!backdrop || !modal) {
      console.warn('Worksheet modal elements not found');
      return;
    }

    // Önceki verileri temizle
    this.resetForm();

    // Öğrencileri yükle
    if (tenantId) {
      this.loadStudents(tenantId);
    }

    // Prefill data varsa ekle
    if (prefillData.examType) {
      const examSelect = document.getElementById('w-exam');
      if (examSelect) examSelect.value = prefillData.examType;
      this.examType = prefillData.examType;
      this.populateSubjects(prefillData.examType);

      if (prefillData.subject) {
        document.getElementById('w-subject').value = prefillData.subject;
        this.subject = prefillData.subject;
        this.populateTopics(prefillData.examType, prefillData.subject);

        if (prefillData.topic) {
          document.getElementById('w-topic').value = prefillData.topic;
          this.topic = prefillData.topic;
        }
      }
    }

    backdrop.style.display = 'grid';
    modal.style.display = 'flex';
    this.isOpen = true;

    document.body.style.overflow = 'hidden';
    document.getElementById('w-title').focus();
  }

  // Modal'ı kapat
  close() {
    const backdrop = document.getElementById('worksheet-modal-backdrop');
    const modal = document.getElementById('worksheet-modal');

    if (backdrop) backdrop.style.display = 'none';
    if (modal) modal.style.display = 'none';

    this.isOpen = false;
    document.body.style.overflow = '';
    this.resetForm();
  }

  // Öğrencileri yükle
  async loadStudents(tenantId) {
    const studentSelect = document.getElementById('w-student');
    if (!studentSelect || !tenantId) return;

    try {
      const response = await fetch(`/api/tenants/${tenantId}/students`, { credentials: 'include' });
      if (!response.ok) return;

      const students = await response.json();
      studentSelect.innerHTML = '<option value="">Öğrenci seçin</option>';

      if (Array.isArray(students)) {
        students.forEach(student => {
          const option = document.createElement('option');
          option.value = student.id;
          option.textContent = (student.firstName || '') + ' ' + (student.lastName || '');
          studentSelect.appendChild(option);
        });
      }
    } catch (err) {
      console.error('Failed to load students:', err);
    }
  }

  // Form'u temizle
  resetForm() {
    const form = document.getElementById('w-form');
    if (form) form.reset();

    const examSelect = document.getElementById('w-exam');
    if (examSelect) examSelect.value = '';

    document.getElementById('w-subject').innerHTML = '<option value="">Sınav türü seç</option>';
    document.getElementById('w-topic').innerHTML = '<option value="">Ders seç</option>';
    document.getElementById('w-status').innerHTML = '';
    document.getElementById('w-status').classList.add('hidden');

    // Soru detaylarını temizle
    const promptArea = document.getElementById('w-prompt');
    if (promptArea) promptArea.value = '';
    const answerInput = document.getElementById('w-answer');
    if (answerInput) answerInput.value = '';
    const explanationArea = document.getElementById('w-explanation');
    if (explanationArea) explanationArea.value = '';
    const difficultySelect = document.getElementById('w-difficulty');
    if (difficultySelect) difficultySelect.value = 'Orta';
    const typeSelect = document.getElementById('w-type');
    if (typeSelect) typeSelect.value = 'ShortAnswer';
    const publishedCheckbox = document.getElementById('w-published');
    if (publishedCheckbox) publishedCheckbox.checked = false;

    this.examType = '';
    this.subject = '';
    this.topic = '';
    this.studentId = '';
  }

  // Sınav türü seç
  selectExam(examCode) {
    this.examType = examCode;
    this.populateSubjects(examCode);
    document.getElementById('w-topic').innerHTML = '<option value="">Ders seç</option>';
  }

  // Dersleri populate et
  populateSubjects(examType) {
    const select = document.getElementById('w-subject');
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
    const select = document.getElementById('w-topic');
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

  // Initialize - Event listener'ları ekle
  init() {
    const studentSelect = document.getElementById('w-student');
    const selectAllCheckbox = document.getElementById('w-select-all-students');
    const examSelect = document.getElementById('w-exam');
    const subjectSelect = document.getElementById('w-subject');
    const topicSelect = document.getElementById('w-topic');
    const closeBtn = document.getElementById('w-close');
    const backdrop = document.getElementById('worksheet-modal-backdrop');
    const cancelBtn = document.getElementById('w-cancel');
    const submitBtn = document.getElementById('w-submit');
    const form = document.getElementById('w-form');
    const fileInput = document.getElementById('w-file');

    // Öğrenci seçimi
    if (studentSelect) {
      studentSelect.addEventListener('change', (e) => {
        this.studentId = e.target.value;
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
      });
    }

    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.studentId = 'all';
          if (studentSelect) studentSelect.value = '';
        } else {
          this.studentId = '';
        }
      });
    }

    // Sınav türü dropdown'ı
    if (examSelect) {
      examSelect.addEventListener('change', (e) => {
        this.selectExam(e.target.value);
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

    // Dosya seçim listener'ı
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const fileName = document.getElementById('w-file-name');
        if (e.target.files.length > 0) {
          const file = e.target.files[0];
          const maxSize = 20 * 1024 * 1024; // 20MB
          if (file.size > maxSize) {
            if (fileName) fileName.textContent = '❌ Dosya çok büyük (Max 20MB)';
            e.target.value = '';
          } else {
            if (fileName) fileName.textContent = `✓ ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`;
          }
        } else {
          if (fileName) fileName.textContent = 'Dosya seçilmedi';
        }
      });
    }

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

    // Sınav türlerini dropdown'a ekle
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
    const studentId = this.studentId.trim();
    const examType = this.examType.trim();
    const subject = document.getElementById('w-subject').value.trim();
    const topic = document.getElementById('w-topic').value.trim();
    const prompt = document.getElementById('w-prompt').value.trim();
    const answer = document.getElementById('w-answer').value.trim();
    const explanation = document.getElementById('w-explanation').value.trim();
    const difficulty = document.getElementById('w-difficulty').value;
    const questionType = document.getElementById('w-type').value;
    const published = document.getElementById('w-published').checked;

    const status = document.getElementById('w-status');

    // Zorunlu alanları kontrol et
    if (!studentId) {
      status.textContent = '❌ Lütfen öğrenci seçin veya "Tüm öğrencilere gönder" seçeneğini işaretleyin';
      status.className = 'w-status-error';
      status.classList.remove('hidden');
      return;
    }

    if (!examType || !subject || !topic) {
      status.textContent = '❌ Lütfen sınav türü, ders ve konu seçin';
      status.className = 'w-status-error';
      status.classList.remove('hidden');
      return;
    }

    if (!prompt || !answer) {
      status.textContent = '❌ Soru metni ve cevap gerekli';
      status.className = 'w-status-error';
      status.classList.remove('hidden');
      return;
    }

    status.textContent = '⏳ Soru gönderiliyor...';
    status.className = 'w-status-info';
    status.classList.remove('hidden');

    // Custom submit handler varsa kullan
    if (this.onSubmit && typeof this.onSubmit === 'function') {
      const data = {
        studentId,
        examType,
        subject,
        topic,
        prompt,
        answer,
        explanation: explanation || null,
        difficulty,
        questionType,
        isPublished: published
      };

      result = await this.onSubmit(data, false);

      if (result.success) {
        status.textContent = '✅ Çalışma gönderildi!';
        status.className = 'w-status-success';
        setTimeout(() => {
          this.close();
          if (result.callback) result.callback();
        }, 1500);
      } else {
        status.textContent = '❌ ' + (result.error || 'Çalışma gönderilemedi');
        status.className = 'w-status-error';
      }
    }
  }
}

// Global instance
window.worksheetModal = new WorksheetModal();
