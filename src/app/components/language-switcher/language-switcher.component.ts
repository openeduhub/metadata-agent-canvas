import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService, LanguageConfig, SupportedLanguage } from '../../services/i18n.service';
import { TranslateModule } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule
  ],
  templateUrl: './language-switcher.component.html',
  styleUrls: ['./language-switcher.component.scss']
})
export class LanguageSwitcherComponent implements OnInit {
  currentLanguage: LanguageConfig;
  languages: LanguageConfig[];

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
   * Select a language (mat-menu handles close automatically)
   */
  selectLanguage(lang: SupportedLanguage): void {
    this.i18nService.setLanguage(lang);
  }

  /**
   * Check if language is currently active
   */
  isActive(lang: SupportedLanguage): boolean {
    return this.currentLanguage.code === lang;
  }
}
