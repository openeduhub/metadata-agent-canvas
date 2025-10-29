import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService, LanguageConfig, SupportedLanguage } from '../../services/i18n.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './language-switcher.component.html',
  styleUrls: ['./language-switcher.component.scss']
})
export class LanguageSwitcherComponent implements OnInit {
  currentLanguage: LanguageConfig;
  languages: LanguageConfig[];
  showDropdown = false;

  constructor(public i18nService: I18nService) {
    this.languages = i18nService.languages;
    this.currentLanguage = i18nService.getCurrentLanguageConfig();
  }

  ngOnInit(): void {
    // Subscribe to language changes
    this.i18nService.currentLanguage$.subscribe(() => {
      this.currentLanguage = this.i18nService.getCurrentLanguageConfig();
    });
  }

  /**
   * Toggle language dropdown
   */
  toggleDropdown(): void {
    this.showDropdown = !this.showDropdown;
  }

  /**
   * Close dropdown
   */
  closeDropdown(): void {
    this.showDropdown = false;
  }

  /**
   * Select a language
   */
  selectLanguage(lang: SupportedLanguage): void {
    this.i18nService.setLanguage(lang);
    this.closeDropdown();
  }

  /**
   * Check if language is currently active
   */
  isActive(lang: SupportedLanguage): boolean {
    return this.currentLanguage.code === lang;
  }
}
