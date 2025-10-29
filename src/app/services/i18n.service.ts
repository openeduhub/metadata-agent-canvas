import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type SupportedLanguage = 'de' | 'en';

export interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  flag: string; // Unicode flag emoji
}

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private readonly STORAGE_KEY = 'app_language';
  private readonly DEFAULT_LANGUAGE: SupportedLanguage = 'de';
  
  private currentLanguageSubject = new BehaviorSubject<SupportedLanguage>(this.DEFAULT_LANGUAGE);
  public currentLanguage$ = this.currentLanguageSubject.asObservable();
  
  public readonly languages: LanguageConfig[] = [
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'en', name: 'English', flag: '🇬🇧' }
  ];

  constructor(private translate: TranslateService) {
    this.initializeLanguage();
  }

  /**
   * Initialize language from storage or use default
   */
  private initializeLanguage(): void {
    const savedLanguage = this.getSavedLanguage();
    const browserLanguage = this.getBrowserLanguage();
    const initialLanguage = savedLanguage || browserLanguage || this.DEFAULT_LANGUAGE;
    
    // Set available languages
    this.translate.addLangs(this.languages.map(l => l.code));
    
    // Set default language (fallback)
    this.translate.setDefaultLang(this.DEFAULT_LANGUAGE);
    
    // Use initial language
    this.setLanguage(initialLanguage);
  }

  /**
   * Get saved language from localStorage
   */
  private getSavedLanguage(): SupportedLanguage | null {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved && this.isSupportedLanguage(saved)) {
        return saved as SupportedLanguage;
      }
    } catch (error) {
      console.warn('Failed to read language from localStorage:', error);
    }
    return null;
  }

  /**
   * Get browser language
   */
  private getBrowserLanguage(): SupportedLanguage | null {
    const browserLang = navigator.language?.split('-')[0];
    return this.isSupportedLanguage(browserLang) ? browserLang as SupportedLanguage : null;
  }

  /**
   * Check if language code is supported
   */
  private isSupportedLanguage(code: string): boolean {
    return this.languages.some(l => l.code === code);
  }

  /**
   * Set current language
   */
  public setLanguage(lang: SupportedLanguage): void {
    console.log(`🌐 I18nService.setLanguage('${lang}') called`);
    
    if (!this.isSupportedLanguage(lang)) {
      console.warn(`Unsupported language: ${lang}, using default`);
      lang = this.DEFAULT_LANGUAGE;
    }
    
    const currentLang = this.currentLanguageSubject.value;
    console.log(`   Current: ${currentLang} → New: ${lang}`);
    
    if (currentLang === lang) {
      console.log(`   ⚠️ Same language, skipping (would not trigger subscribers)`);
      return;
    }
    
    this.translate.use(lang);
    console.log(`   📤 Emitting to currentLanguageSubject...`);
    this.currentLanguageSubject.next(lang);
    
    // Save to localStorage
    try {
      localStorage.setItem(this.STORAGE_KEY, lang);
    } catch (error) {
      console.warn('Failed to save language to localStorage:', error);
    }
    
    // Update HTML lang attribute for accessibility
    document.documentElement.lang = lang;
  }

  /**
   * Get current language
   */
  public getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguageSubject.value;
  }

  /**
   * Get current language config
   */
  public getCurrentLanguageConfig(): LanguageConfig {
    const currentLang = this.getCurrentLanguage();
    return this.languages.find(l => l.code === currentLang) || this.languages[0];
  }

  /**
   * Switch to next language (toggle between available languages)
   */
  public toggleLanguage(): void {
    const currentIndex = this.languages.findIndex(l => l.code === this.getCurrentLanguage());
    const nextIndex = (currentIndex + 1) % this.languages.length;
    this.setLanguage(this.languages[nextIndex].code);
  }

  /**
   * Get translation for a key
   */
  public instant(key: string, params?: any): string {
    return this.translate.instant(key, params);
  }

  /**
   * Get translation observable for a key
   */
  public get(key: string, params?: any): Observable<string> {
    return this.translate.get(key, params);
  }
}
