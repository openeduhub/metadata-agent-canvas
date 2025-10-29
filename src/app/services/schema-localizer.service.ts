import { Injectable } from '@angular/core';
import { I18nService, SupportedLanguage } from './i18n.service';

/**
 * Schema Localizer Service
 * Handles localization of schema data (labels, descriptions, examples, vocabularies)
 */
@Injectable({
  providedIn: 'root'
})
export class SchemaLocalizerService {

  constructor(private i18n: I18nService) {}

  /**
   * Get active language
   */
  getActiveLanguage(): SupportedLanguage {
    return this.i18n.getCurrentLanguage();
  }

  /**
   * Localize a string value (supports i18n objects like {de: "...", en: "..."})
   */
  localizeString(value: any, language?: SupportedLanguage, fallback?: string): string {
    const lang = language || this.getActiveLanguage();
    
    if (!value) {
      return fallback ?? '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'object') {
      return value[lang] ?? value['de'] ?? value['en'] ?? fallback ?? '';
    }

    return fallback ?? '';
  }

  /**
   * Localize examples array
   */
  localizeExamples(examples: any, language?: SupportedLanguage): any[] | undefined {
    const lang = language || this.getActiveLanguage();
    
    if (!examples) {
      return undefined;
    }

    if (Array.isArray(examples)) {
      return examples;
    }

    if (typeof examples === 'object') {
      const localized = examples[lang] ?? examples['de'] ?? examples['en'];
      return localized ? (Array.isArray(localized) ? localized : [localized]) : undefined;
    }

    return undefined;
  }

  /**
   * Merge multiple example sets
   */
  mergeExamples(...exampleSets: Array<any[] | undefined>): any[] | undefined {
    const merged = exampleSets
      .filter((set): set is any[] => Array.isArray(set) && set.length > 0)
      .flat();
    return merged.length > 0 ? merged : undefined;
  }

  /**
   * Localize vocabulary (concepts with labels, descriptions, altLabels)
   * Preserves original label_de and label_en for cross-language value matching
   */
  localizeVocabulary(vocabulary: any, language?: SupportedLanguage) {
    const lang = language || this.getActiveLanguage();
    const type = (vocabulary.type === 'closed' || vocabulary.type === 'skos')
      ? vocabulary.type
      : 'closed';

    const concepts = (vocabulary.concepts || []).map((concept: any) => {
      // Extract original labels for both languages (for cross-language matching)
      const labelDe = this.localizeString(concept.label, 'de');
      const labelEn = this.localizeString(concept.label, 'en');
      
      return {
        ...concept,
        label: this.localizeString(concept.label, lang) || concept.uri || concept.label,
        label_de: labelDe,  // Preserve German label
        label_en: labelEn,  // Preserve English label
        description: this.localizeString(concept.description, lang) || undefined,
        altLabels: this.localizeAltLabels(concept.altLabels, lang)
      };
    });

    return { type, concepts };
  }

  /**
   * Localize alternative labels
   */
  private localizeAltLabels(altLabels: any, language: SupportedLanguage): string[] | undefined {
    if (!altLabels) {
      return undefined;
    }

    if (Array.isArray(altLabels)) {
      return altLabels;
    }

    if (typeof altLabels === 'object') {
      const localized = altLabels[language] ?? altLabels['de'] ?? altLabels['en'];
      return localized ? (Array.isArray(localized) ? localized : [localized]) : undefined;
    }

    return undefined;
  }

  /**
   * Get fallback group label based on language
   */
  getFallbackGroupLabel(language?: SupportedLanguage): string {
    const lang = language || this.getActiveLanguage();
    return lang === 'en' ? 'Other' : 'Sonstige';
  }

  /**
   * Localize field object from schema
   */
  localizeField(field: any, language?: SupportedLanguage): any {
    const lang = language || this.getActiveLanguage();
    
    return {
      ...field,
      label: this.localizeString(field.label, lang) || field.id,
      description: this.localizeString(field.description, lang) 
        || this.localizeString(field.prompt?.description, lang) 
        || '',
      group_label: field.group_label ? this.localizeString(field.group_label, lang) : undefined,
      examples: this.mergeExamples(
        this.localizeExamples(field.examples, lang),
        this.localizeExamples(field.prompt?.examples, lang)
      ),
      prompt: this.localizeString(field.prompt, lang),
      vocabulary: field.system?.vocabulary 
        ? this.localizeVocabulary(field.system.vocabulary, lang)
        : undefined
    };
  }
}
