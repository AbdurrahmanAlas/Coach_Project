// Professional Modal System - Çalışma Gönder (Send Assignment/Worksheet)

class WorksheetModal {
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

    const backdrop = document.getElementById('worksheet-modal-backdrop');
    const modal = document.getElementById('worksheet-modal');

    if (!backdrop || !modal) {
      console.warn('Worksheet modal elements not found');
      return;
    }

    // Önceki verileri temizle
    this.resetForm();

    // Prefill data varsa ekle
    if (prefillData.examType) {
      this.examType = prefillData.examType;
      this.selectExam(prefillData.examType);
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

  // Form'u temizle
  resetForm() {
    const form = document.getElementById('w-form');
    if (form) form.reset();

    document.getElementById('w-subject').innerHTML = '<option value="">Sınav türü seç</option>';
    document.getElementById('w-topic').innerHTML = '<option value="">Ders seç</option>';
    document.getElementById('w-status').innerHTML = '';
    document.getElementById('w-status').classList.add('hidden');

    // Sınav düğmelerini pasif yap
    document.querySelectorAll('.w-exam-btn').forEach(btn => btn.classList.remove('active'));

    // Dosya seçimini sıfırla
    const fileInput = document.getElementById('w-file');
    const fileName = document.getElementById('w-file-name');
    if (fileInput) fileInput.value = '';
    if (fileName) fileName.textContent = 'Dosya seçilmedi';

    this.examType = '';
    this.subject = '';
    this.topic = '';
  }

  // Sınav türü seç
  selectExam(examCode) {
    this.examType = examCode;
    document.querySelectorAll('.w-exam-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.exam === examCode);
    });
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
    const examButtons = document.querySelectorAll('.w-exam-btn');
    const subjectSelect = document.getElementById('w-subject');
    const topicSelect = document.getElementById('w-topic');
    const closeBtn = document.getElementById('w-close');
    const backdrop = document.getElementById('worksheet-modal-backdrop');
    const cancelBtn = document.getElementById('w-cancel');
    const submitBtn = document.getElementById('w-submit');
    const form = document.getElementById('w-form');
    const fileInput = document.getElementById('w-file');

    // Sınav türü düğmeleri
    examButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectExam(btn.dataset.exam);
      });
    });

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
  }

  // Form'u submit et
  async submit() {
    const examType = this.examType.trim();
    const subject = document.getElementById('w-subject').value.trim();
    const topic = document.getElementById('w-topic').value.trim();
    const title = document.getElementById('w-title').value.trim();
    const description = document.getElementById('w-description').value.trim();
    const fileInput = document.getElementById('w-file');

    const status = document.getElementById('w-status');

    // En az sınav türü gerekli
    if (!examType) {
      status.textContent = '❌ Lütfen sınav türü seçin (TYT, AYT, KPSS, YÖS, DGS)';
      status.className = 'w-status-error';
      status.classList.remove('hidden');
      return;
    }

    status.textContent = '⏳ Gönderiliyor...';
    status.className = 'w-status-info';
    status.classList.remove('hidden');

    // Custom submit handler varsa kullan
    if (this.onSubmit && typeof this.onSubmit === 'function') {
      const data = {
        examType,
        subject: subject || null,
        topic: topic || null,
        title: title || null,
        description: description || null
      };

      // Eğer dosya varsa FormData kullan, yoksa JSON kullan
      let result;
      if (fileInput && fileInput.files.length > 0) {
        const formData = new FormData();
        Object.keys(data).forEach(key => {
          formData.append(key, data[key]);
        });
        formData.append('file', fileInput.files[0]);
        result = await this.onSubmit(formData, true); // true = formData flag
      } else {
        result = await this.onSubmit(data, false);
      }

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
