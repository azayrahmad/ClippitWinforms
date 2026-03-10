export interface TTSOptions {
  voice?: SpeechSynthesisVoice | null;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export class Balloon {
  private _targetEl: HTMLElement;
  private _balloonEl: HTMLElement;
  private _contentEl: HTMLElement;
  private _hidden: boolean = true;
  private _active: boolean = false;
  private _hold: boolean = false;
  private _hidingTimeout: number | null = null;
  private _loopTimeout: number | null = null;
  private _completeCallback: (() => void) | null = null;
  private _addWord: (() => void) | null = null;

  private _ttsEnabled: boolean = !!window.speechSynthesis;
  private _ttsUserEnabled: boolean = this._ttsEnabled;
  private _currentUtterance: SpeechSynthesisUtterance | null = null;
  private _ttsOptions: Required<TTSOptions> = {
    voice: null,
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0
  };

  private _ttsFallbackTimer: number | null = null;
  private _mobileTTSTimer: number | null = null;
  private _isMobile: boolean = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  public WORD_SPEAK_TIME = 200;
  public CLOSE_BALLOON_DELAY = 2000;
  private _BALLOON_MARGIN = 15;

  constructor(targetEl: HTMLElement, container: HTMLElement | ShadowRoot) {
    this._targetEl = targetEl;

    this._balloonEl = document.createElement('div');
    this._balloonEl.className = 'clippy-balloon';
    this._balloonEl.style.display = 'none';
    this._balloonEl.style.position = 'absolute';

    const tip = document.createElement('div');
    tip.className = 'clippy-tip';
    this._balloonEl.appendChild(tip);

    this._contentEl = document.createElement('div');
    this._contentEl.className = 'clippy-content';
    this._balloonEl.appendChild(this._contentEl);

    container.appendChild(this._balloonEl);
  }

  public reposition() {
    const sides = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    for (const side of sides) {
      this._position(side);
      if (!this._isOut()) break;
    }
  }

  private _position(side: string) {
    const rect = this._targetEl.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // Balloon size
    this._balloonEl.style.visibility = 'hidden';
    this._balloonEl.style.display = 'block';
    const bW = this._balloonEl.offsetWidth;
    const bH = this._balloonEl.offsetHeight;
    this._balloonEl.style.display = this._hidden ? 'none' : 'block';
    this._balloonEl.style.visibility = 'visible';

    this._balloonEl.classList.remove('clippy-top-left', 'clippy-top-right', 'clippy-bottom-right', 'clippy-bottom-left');

    let left = 0;
    let top = 0;

    switch (side) {
      case 'top-left':
        left = w - bW;
        top = -bH - this._BALLOON_MARGIN;
        break;
      case 'top-right':
        left = 0;
        top = -bH - this._BALLOON_MARGIN;
        break;
      case 'bottom-right':
        left = 0;
        top = h + this._BALLOON_MARGIN;
        break;
      case 'bottom-left':
        left = w - bW;
        top = h + this._BALLOON_MARGIN;
        break;
    }

    this._balloonEl.style.top = `${top}px`;
    this._balloonEl.style.left = `${left}px`;
    this._balloonEl.classList.add(`clippy-${side}`);
  }

  private _isOut(): boolean {
    const rect = this._balloonEl.getBoundingClientRect();
    const m = 5;
    if (rect.top - m < 0 || rect.left - m < 0) return true;
    if (rect.bottom + m > window.innerHeight || rect.right + m > window.innerWidth) return true;
    return false;
  }

  public speak(complete: () => void, text: string, hold: boolean, useTTS: boolean) {
    this._hidden = false;
    this.show();

    this._contentEl.style.height = 'auto';
    this._contentEl.style.width = 'auto';
    this._contentEl.textContent = text;

    const height = this._contentEl.offsetHeight;
    const width = this._contentEl.offsetWidth;

    this._contentEl.style.height = `${height}px`;
    this._contentEl.style.width = `${width}px`;
    this._contentEl.textContent = '';

    this.reposition();
    this._completeCallback = complete;

    if (useTTS && this._ttsEnabled && this._ttsUserEnabled) {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        setTimeout(() => {
          const innerVoices = window.speechSynthesis.getVoices();
          if (innerVoices.length === 0) {
            this._sayWords(text, hold, complete);
          } else {
            this._sayWordsWithTTS(text, hold, complete);
          }
        }, 250);
      } else {
        this._sayWordsWithTTS(text, hold, complete);
      }
    } else {
      this._sayWords(text, hold, complete);
    }
  }

  public showHtml(html: string, hold: boolean) {
    this._hidden = false;
    this._balloonEl.style.visibility = 'hidden';
    this._balloonEl.style.display = 'block';

    this._contentEl.style.height = 'auto';
    this._contentEl.style.width = 'auto';
    this._contentEl.innerHTML = html;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.reposition();
        this._balloonEl.style.visibility = 'visible';
        this._active = true;
        this._hold = hold;
      });
    });
  }

  public show() {
    if (this._hidden) return;
    this._balloonEl.style.display = 'block';
  }

  public hide(fast: boolean = false) {
    if (fast) {
      this._balloonEl.style.display = 'none';
      this._hidden = true;
      return;
    }
    this._hidingTimeout = window.setTimeout(() => this._finishHideBalloon(), this.CLOSE_BALLOON_DELAY);
  }

  private _finishHideBalloon() {
    if (this._active) return;
    this._balloonEl.style.display = 'none';
    this._hidden = true;
    this._hidingTimeout = null;
  }

  private _sayWords(text: string, hold: boolean, complete: () => void) {
    this._active = true;
    this._hold = hold;
    const words = text.split(/[^\S-]/);
    const time = this.WORD_SPEAK_TIME;
    let idx = 1;

    this._addWord = () => {
      if (!this._active) return;
      if (idx > words.length) {
        this._addWord = null;
        this._active = false;
        if (!this._hold) {
          complete();
          this.hide();
        }
      } else {
        this._contentEl.textContent = words.slice(0, idx).join(' ');
        idx++;
        this._loopTimeout = window.setTimeout(() => this._addWord?.(), time);
      }
    };
    this._addWord();
  }

  private _sayWordsWithTTS(text: string, hold: boolean, complete: () => void) {
    this._active = true;
    this._hold = hold;
    const words = text.split(/[^\S-]/);
    let idx = 1;

    if (this._isMobile) {
      const onEnd = () => {
        if (this._mobileTTSTimer) {
          clearTimeout(this._mobileTTSTimer);
          this._mobileTTSTimer = null;
        }
        this._contentEl.textContent = text;
        this._active = false;
        if (!this._hold) {
          complete();
          this.hide();
        }
      };
      this._speakTTS(text, null, onEnd);

      const timePerWord = (this.WORD_SPEAK_TIME / (this._ttsOptions.rate || 1.0));
      const addWord = () => {
        if (!this._active) return;
        if (idx > words.length) return;
        this._contentEl.textContent = words.slice(0, idx).join(' ');
        idx++;
        this._mobileTTSTimer = window.setTimeout(addWord, timePerWord);
      };
      addWord();
      return;
    }

    if (this._ttsFallbackTimer) {
      clearTimeout(this._ttsFallbackTimer);
      this._ttsFallbackTimer = null;
    }

    const startFallbackTimer = () => {
      const timePerWord = (this.WORD_SPEAK_TIME / (this._ttsOptions.rate || 1.0)) * 1.2;
      const addWord = () => {
        if (!this._active) return;
        if (idx > words.length) return;
        this._contentEl.textContent = words.slice(0, idx).join(' ');
        idx++;
        if (idx <= words.length) {
          this._ttsFallbackTimer = window.setTimeout(addWord, timePerWord);
        }
      };
      this._ttsFallbackTimer = window.setTimeout(addWord, 300);
    };

    this._speakTTS(text, (charIndex) => {
      let charCount = 0;
      let currentWordIndex = 0;
      for (let i = 0; i < words.length; i++) {
        charCount += words[i].length + 1;
        if (charIndex < charCount) {
          currentWordIndex = i;
          break;
        }
      }
      if (currentWordIndex + 1 > idx) {
        idx = currentWordIndex + 1;
        this._contentEl.textContent = words.slice(0, idx).join(' ');
      }
    }, () => {
      if (this._ttsFallbackTimer) {
        clearTimeout(this._ttsFallbackTimer);
        this._ttsFallbackTimer = null;
      }
      this._contentEl.textContent = text;
      this._active = false;
      if (!this._hold) {
        complete();
        this.hide();
      }
    });

    startFallbackTimer();
  }

  private _speakTTS(text: string, onWord: ((charIndex: number) => void) | null, onEnd: () => void) {
    this.stopTTS();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this._ttsOptions.rate;
    utterance.pitch = this._ttsOptions.pitch;
    utterance.volume = this._ttsOptions.volume;
    if (this._ttsOptions.voice) {
      utterance.voice = this._ttsOptions.voice;
    }

    utterance.onboundary = (event) => {
      if (event.name === 'word' && onWord) {
        onWord(event.charIndex);
      }
    };
    utterance.onend = () => onEnd();
    utterance.onerror = () => onEnd();

    this._currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  public stopTTS() {
    if (this._currentUtterance && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      this._currentUtterance = null;
    }
  }

  public isTTSEnabled(): boolean {
    return this._ttsUserEnabled;
  }

  public setTTSEnabled(enabled: boolean) {
    this._ttsUserEnabled = this._ttsEnabled && enabled;
  }

  public setTTSOptions(options: TTSOptions) {
    this._ttsOptions = { ...this._ttsOptions, ...options };
  }

  public getTTSVoices(): SpeechSynthesisVoice[] {
    return window.speechSynthesis.getVoices();
  }

  public close() {
    if (this._active) {
      this._hold = false;
    } else if (this._hold) {
      this._completeCallback?.();
      this.hide(true);
    }
  }

  public pause() {
    if (this._loopTimeout) clearTimeout(this._loopTimeout);
    if (this._hidingTimeout) clearTimeout(this._hidingTimeout);
    if (this._ttsFallbackTimer) clearTimeout(this._ttsFallbackTimer);
  }

  public resume() {
    if (this._addWord) this._addWord();
    this._hidingTimeout = window.setTimeout(() => this._finishHideBalloon(), this.CLOSE_BALLOON_DELAY);
  }

  public get balloonEl() {
    return this._balloonEl;
  }
}
