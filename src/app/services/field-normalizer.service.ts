/**
 * Field Normalizer Service
 * Normalizes user input based on field schema
 * Does NOT re-evaluate, only formats/structures the input
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { CanvasFieldState } from '../models/canvas-models';
import { environment } from '../../environments/environment';
import { PlatformDetectionService } from './platform-detection.service';

@Injectable({
  providedIn: 'root'
})
export class FieldNormalizerService {
  // Use environment-based proxy URL (same as OpenAI Proxy Service)
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private platformDetection: PlatformDetectionService
  ) {
    // Get proxy URL from environment config (same pattern as openai-proxy.service)
    const provider = environment.llmProvider || 'b-api-openai';
    const providerConfig = (environment as any)[this.getProviderConfigKey(provider)];
    
    if (environment.production) {
      // Production: Use Platform Detection (works for Vercel AND Netlify)
      this.apiUrl = providerConfig?.proxyUrl || this.platformDetection.getOpenAIProxyUrl();
      console.log(`🔧 FieldNormalizerService: ${this.platformDetection.getPlatformName()} → ${this.apiUrl}`);
    } else {
      // Local: Use local proxy
      this.apiUrl = providerConfig?.proxyUrl || 'http://localhost:3001/llm';
      console.log('🔧 FieldNormalizerService: Local development → http://localhost:3001/llm');
    }
  }
  
  /**
   * Get provider config key based on provider name
   */
  private getProviderConfigKey(provider: string): string {
    if (provider === 'b-api-openai') return 'bApiOpenai';
    if (provider === 'b-api-academiccloud') return 'bApiAcademicCloud';
    return 'openai';
  }

  /**
   * Normalize user input value based on field schema
   * - Numbers: "zehn" → "10"
   * - Dates: "15.9.2026" → "2026-09-15"
   * - Labels: Fix typos based on vocabulary
   */
  normalizeValue(field: CanvasFieldState, userInput: any): Observable<any> {
    console.log(`🔧 normalizeValue called for ${field.fieldId}:`, {
      userInput,
      datatype: field.datatype,
      hasVocabulary: !!field.vocabulary,
      apiUrl: this.apiUrl
    });

    // Skip normalization for empty values
    if (userInput === null || userInput === undefined || userInput === '') {
      console.log(`⏩ Skipping normalization (empty value)`);
      return of(userInput);
    }

    // Try local normalization first (instant, no API call)
    const localResult = this.tryLocalNormalization(field, userInput);
    
    // Check if local normalization was successful
    // Success means: value changed OR vocabulary validation passed
    const localSuccess = localResult.success;
    const localNormalized = localResult.value;
    
    if (localSuccess) {
      if (localNormalized !== userInput) {
        console.log(`⚡ Local normalization succeeded: "${userInput}" → "${localNormalized}"`);
      } else {
        console.log(`⚡ Local validation succeeded: "${userInput}"`);
      }
      return of(localNormalized);
    }

    // Skip API call for simple cases where LLM is not needed
    if (!this.needsLlmNormalization(field, userInput)) {
      console.log(`⏩ Skipping LLM normalization (not needed for simple case)`);
      return of(userInput);
    }

    // Build normalization prompt
    const prompt = this.buildNormalizationPrompt(field, userInput);
    
    console.log(`📝 Normalization prompt for ${field.fieldId}:`, prompt.substring(0, 200) + '...');

    // Get model from environment
    const provider = environment.llmProvider || 'b-api-openai';
    const providerConfig = (environment as any)[this.getProviderConfigKey(provider)];
    const model = providerConfig?.model || 'gpt-4.1-mini';

    // Use OpenAI-compatible format (works with all proxies)
    return this.http.post<any>(this.apiUrl, {
      provider: provider,  // Tell proxy which LLM provider to use
      model: model,  // Required by API
      messages: [
        { role: 'system', content: 'You are a data normalization assistant. Return ONLY the normalized value without any explanation, parentheses, or additional text.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,  // Low temperature for consistent formatting
      max_tokens: 200
    }).pipe(
      map(response => {
        console.log(`📥 Raw response for ${field.fieldId}:`, response);
        // OpenAI format: response.choices[0].message.content
        const content = response.choices?.[0]?.message?.content || response.content || '';
        const normalized = this.parseNormalizationResponse(content, field, userInput);
        console.log(`✅ Normalized ${field.fieldId}:`, userInput, '→', normalized);
        return normalized;
      }),
      catchError(error => {
        console.error(`❌ Normalization failed for ${field.fieldId}:`, error);
        console.error(`❌ Error details:`, {
          message: error.message,
          status: error.status,
          url: error.url
        });
        
        // Fallback: Try local normalization again
        const fallbackResult = this.tryLocalNormalization(field, userInput);
        if (fallbackResult.success && fallbackResult.value !== userInput) {
          console.log(`🔄 Fallback to local normalization: "${userInput}" → "${fallbackResult.value}"`);
          return of(fallbackResult.value);
        }
        
        // Return original value on error
        console.warn(`⚠️ No normalization possible, keeping original value: "${userInput}"`);
        return of(userInput);
      })
    );
  }

  /**
   * Check if LLM normalization is needed (to avoid unnecessary API calls)
   */
  private needsLlmNormalization(field: CanvasFieldState, userInput: any): boolean {
    // LLM is only needed for:
    // 1. Complex number words that local parser can't handle
    // 2. Complex date formats that local parser can't handle
    // 3. Vocabulary fields that need semantic matching (beyond fuzzy)
    
    // For simple strings without vocabulary: No LLM needed
    const hasVocabulary = field.vocabulary && field.vocabulary.concepts && field.vocabulary.concepts.length > 0;
    
    if (field.datatype === 'string' && !hasVocabulary) {
      return false;
    }
    
    // For arrays of simple strings: No LLM needed
    if (field.datatype === 'array' && !hasVocabulary) {
      return false;
    }
    
    // For already normalized values: No LLM needed
    if (field.datatype === 'boolean' && typeof userInput === 'boolean') {
      return false;
    }
    if ((field.datatype === 'number' || field.datatype === 'integer') && typeof userInput === 'number') {
      return false;
    }
    // Date fields: Accept both YYYY-MM-DD and ISO 8601 datetime formats
    if (field.datatype === 'date' && typeof userInput === 'string') {
      if (/^\d{4}-\d{2}-\d{2}($|T)/.test(userInput)) {
        return false; // Already in ISO format (date or datetime)
      }
    }
    if (field.datatype === 'datetime' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(userInput)) {
      return false; // Already in ISO 8601 datetime format
    }
    
    // For everything else: Try LLM (complex cases)
    return true;
  }

  /**
   * Try local normalization without LLM (instant)
   * Returns {success: boolean, value: any}
   * success=true means normalization/validation was successful (no LLM needed)
   */
  private tryLocalNormalization(field: CanvasFieldState, userInput: any): {success: boolean, value: any} {
    // 1. Boolean fields: ja/nein → true/false
    if (field.datatype === 'boolean') {
      const boolMatch = this.tryParseBoolean(userInput);
      if (boolMatch !== null && boolMatch !== userInput) {
        console.log(`  ✅ Boolean conversion: "${userInput}" → ${boolMatch}`);
        return {success: true, value: boolMatch};
      }
    }

    // 2. Vocabulary fields: Exact and fuzzy matching
    if (field.vocabulary && field.vocabulary.concepts && field.vocabulary.concepts.length > 0) {
      const vocabMatch = this.validateVocabulary(userInput, field);
      // If validation returned a value (not null), it means a match was found
      // Even if it's the same value, it's been validated against vocabulary
      if (vocabMatch !== null) {
        if (vocabMatch !== userInput) {
          console.log(`  📋 Vocabulary match: "${userInput}" → "${vocabMatch}"`);
        } else {
          console.log(`  ✅ Vocabulary exact match: "${userInput}"`);
        }
        return {success: true, value: vocabMatch};
      }
    }

    // 3. Number fields: Word to number conversion
    if (field.datatype === 'number' || field.datatype === 'integer') {
      const numberMatch = this.tryParseNumber(userInput);
      if (numberMatch !== null && numberMatch !== userInput) {
        console.log(`  🔢 Number conversion: "${userInput}" → ${numberMatch}`);
        return {success: true, value: numberMatch};
      }
    }

    // 4. Date fields: Parse various date formats
    if (field.datatype === 'date') {
      const dateMatch = this.tryParseDate(userInput);
      if (dateMatch !== null && dateMatch !== userInput) {
        console.log(`  📅 Date conversion: "${userInput}" → "${dateMatch}"`);
        return {success: true, value: dateMatch};
      }
    }

    // 5. URL fields: Add protocol if missing
    if (field.datatype === 'uri' || field.datatype === 'url') {
      const urlMatch = this.tryParseUrl(userInput);
      if (urlMatch !== null && urlMatch !== userInput) {
        console.log(`  🔗 URL conversion: "${userInput}" → "${urlMatch}"`);
        return {success: true, value: urlMatch};
      }
    }

    // 6. Geo coordinates: Parse from string
    if (field.fieldId?.includes('latitude') || field.fieldId?.includes('longitude')) {
      const geoMatch = this.tryParseGeoCoordinate(userInput, field.fieldId);
      if (geoMatch !== null && geoMatch !== userInput) {
        console.log(`  🗺️ Geo coordinate: "${userInput}" → ${geoMatch}`);
        return {success: true, value: geoMatch};
      }
    }

    // No local normalization possible
    return {success: false, value: userInput};
  }

  /**
   * Try to parse boolean from ja/nein or true/false
   */
  private tryParseBoolean(value: any): boolean | null {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return null;

    const str = value.toLowerCase().trim();

    // German: ja/nein
    if (str === 'ja' || str === 'yes' || str === 'wahr' || str === 'true' || str === '1') {
      return true;
    }
    if (str === 'nein' || str === 'no' || str === 'falsch' || str === 'false' || str === '0') {
      return false;
    }

    return null;
  }

  /**
   * Try to parse number from text (including German number words)
   */
  private tryParseNumber(value: any): number | null {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return null;

    const str = value.toLowerCase().trim();

    // German number words mapping (expanded)
    const germanNumbers: { [key: string]: number } = {
      'null': 0, 'eins': 1, 'zwei': 2, 'drei': 3, 'vier': 4,
      'fünf': 5, 'sechs': 6, 'sieben': 7, 'acht': 8, 'neun': 9,
      'zehn': 10, 'elf': 11, 'zwölf': 12, 'dreizehn': 13, 'vierzehn': 14,
      'fünfzehn': 15, 'sechzehn': 16, 'siebzehn': 17, 'achtzehn': 18, 'neunzehn': 19,
      'zwanzig': 20, 'einundzwanzig': 21, 'zweiundzwanzig': 22, 'dreiundzwanzig': 23,
      'vierundzwanzig': 24, 'fünfundzwanzig': 25, 'dreißig': 30, 'vierzig': 40, 
      'fünfzig': 50, 'sechzig': 60, 'siebzig': 70, 'achtzig': 80, 'neunzig': 90,
      'hundert': 100, 'zweihundert': 200, 'dreihundert': 300, 'vierhundert': 400,
      'fünfhundert': 500, 'tausend': 1000, 'zweitausend': 2000
    };

    // Check direct word match
    if (germanNumbers[str] !== undefined) {
      console.log(`  ✅ German number word matched: "${str}" → ${germanNumbers[str]}`);
      return germanNumbers[str];
    }

    // Try to parse as number
    const num = Number(str);
    if (!isNaN(num)) {
      return num;
    }

    // If no match, return null so LLM fallback can try
    console.log(`  ⚠️ Number "${str}" not recognized locally, needs LLM fallback`);
    return null;
  }

  /**
   * Try to parse URL and add protocol if missing
   */
  private tryParseUrl(value: any): string | null {
    if (!value || typeof value !== 'string') return null;
    
    const str = value.trim();
    
    // Already has protocol
    if (/^https?:\/\//i.test(str)) {
      return str;
    }
    
    // Add https:// if it looks like a URL
    if (/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/i.test(str)) {
      console.log(`  🔗 Added protocol to URL: "${str}" → "https://${str}"`);
      return `https://${str}`;
    }
    
    return null;
  }

  /**
   * Try to parse date from various formats to ISO format (YYYY-MM-DD)
   */
  private tryParseDate(value: any): string | null {
    if (typeof value !== 'string') return null;

    const str = value.trim();

    // Already in ISO format?
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      console.log(`  ✅ Date already in ISO format: "${str}"`);
      return str;
    }

    // Try various formats
    const formats = [
      // DD.MM.YYYY or D.M.YYYY (German standard)
      { regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, dayFirst: true, name: 'DD.MM.YYYY' },
      // DD/MM/YYYY or D/M/YYYY
      { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, dayFirst: true, name: 'DD/MM/YYYY' },
      // DD-MM-YYYY or D-M-YYYY (but NOT YYYY-MM-DD which is handled above)
      { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, dayFirst: true, name: 'DD-MM-YYYY' },
      // YYYY.MM.DD
      { regex: /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/, dayFirst: false, name: 'YYYY.MM.DD' },
      // YYYY/MM/DD
      { regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, dayFirst: false, name: 'YYYY/MM/DD' },
    ];

    for (const format of formats) {
      const match = str.match(format.regex);
      if (match) {
        let year: number, month: number, day: number;

        if (format.dayFirst) {
          // DD-MM-YYYY format
          day = parseInt(match[1]);
          month = parseInt(match[2]);
          year = parseInt(match[3]);
        } else {
          // YYYY-MM-DD format
          year = parseInt(match[1]);
          month = parseInt(match[2]);
          day = parseInt(match[3]);
        }

        // Validate date ranges
        if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          // Additional validation: Check if date is actually valid (e.g., not 31.02.2024)
          const testDate = new Date(year, month - 1, day);
          if (testDate.getFullYear() === year && testDate.getMonth() === month - 1 && testDate.getDate() === day) {
            const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            console.log(`  ✅ Date parsed (${format.name}): "${str}" → "${isoDate}"`);
            return isoDate;
          } else {
            console.log(`  ⚠️ Invalid date detected: ${day}.${month}.${year} (e.g., 31. Feb)`);
          }
        }
      }
    }

    // If no format matched, signal that LLM fallback is needed
    console.log(`  ⚠️ Date "${str}" not recognized locally, needs LLM fallback`);
    return null;
  }

  /**
   * Try to parse and validate geo coordinates (latitude/longitude)
   */
  private tryParseGeoCoordinate(value: any, fieldId: string): number | null {
    // Already a number: validate range
    if (typeof value === 'number') {
      return this.validateGeoCoordinate(value, fieldId);
    }
    
    if (typeof value !== 'string') return null;
    
    const str = value.trim();
    
    // Try to parse as number
    const num = parseFloat(str);
    if (isNaN(num)) return null;
    
    // Validate and return
    return this.validateGeoCoordinate(num, fieldId);
  }
  
  /**
   * Validate geo coordinate range
   */
  private validateGeoCoordinate(value: number, fieldId: string): number | null {
    const isLatitude = fieldId.includes('latitude');
    const isLongitude = fieldId.includes('longitude');
    
    if (isLatitude) {
      // Latitude: -90 to 90
      if (value < -90 || value > 90) {
        console.log(`  ⚠️ Invalid latitude: ${value} (must be -90 to 90)`);
        return null;
      }
      // Round to 7 decimal places (~1cm precision)
      return Math.round(value * 10000000) / 10000000;
    } else if (isLongitude) {
      // Longitude: -180 to 180
      if (value < -180 || value > 180) {
        console.log(`  ⚠️ Invalid longitude: ${value} (must be -180 to 180)`);
        return null;
      }
      // Round to 7 decimal places (~1cm precision)
      return Math.round(value * 10000000) / 10000000;
    }
    
    return value;
  }

  /**
   * Build normalization prompt for field
   */
  private buildNormalizationPrompt(field: CanvasFieldState, userInput: any): string {
    let prompt = `Du bist ein Daten-Normalisierer. Deine Aufgabe ist es, Benutzereingaben in das korrekte Format zu bringen.\n\n`;
    
    prompt += `**WICHTIG: Du sollst den Wert NICHT neu bewerten oder interpretieren, sondern nur formatieren!**\n\n`;
    
    prompt += `Feld: ${field.label}\n`;
    prompt += `Beschreibung: ${field.description}\n`;
    prompt += `Datentyp: ${field.datatype}\n`;
    
    // Add datatype-specific instructions
    if (field.datatype === 'boolean') {
      prompt += `\nFormat-Regeln für Boolean:\n`;
      prompt += `- "ja", "yes", "wahr" → true\n`;
      prompt += `- "nein", "no", "falsch" → false\n`;
      prompt += `- Nur true oder false zurückgeben (ohne Anführungszeichen)\n`;
      prompt += `- Bei ungültigen Eingaben: null zurückgeben\n`;
    } else if (field.datatype === 'number' || field.datatype === 'integer') {
      prompt += `\nFormat-Regeln für Zahlen:\n`;
      prompt += `- Zahlwörter in Ziffern umwandeln:\n`;
      prompt += `  - "zehn" → 10\n`;
      prompt += `  - "fünfundzwanzig" → 25\n`;
      prompt += `  - "hundert" → 100\n`;
      prompt += `  - "zweihundertfünfzig" → 250\n`;
      prompt += `  - "eintausendzweihundert" → 1200\n`;
      prompt += `- Auch komplexe Zahlwörter parsen: "dreihundertvierundsiebzig" → 374\n`;
      prompt += `- Nur die Zahl zurückgeben, ohne Text und ohne Anführungszeichen\n`;
      prompt += `- Bei ungültigen Eingaben: null zurückgeben\n`;
    } else if (field.datatype === 'date') {
      prompt += `\nFormat-Regeln für Datum:\n`;
      prompt += `- Immer im Format YYYY-MM-DD zurückgeben (ISO 8601)\n`;
      prompt += `- Verschiedene Eingabeformate erkennen und umwandeln:\n`;
      prompt += `  - "15.9.2026" → "2026-09-15"\n`;
      prompt += `  - "15. September 2026" → "2026-09-15"\n`;
      prompt += `  - "September 15, 2026" → "2026-09-15"\n`;
      prompt += `  - "15/09/2026" → "2026-09-15"\n`;
      prompt += `  - "2026-09-15" → "2026-09-15" (bleibt so)\n`;
      prompt += `  - "15. Sep 2026" → "2026-09-15"\n`;
      prompt += `  - "15.9.26" → "2026-09-15" (2-stelliges Jahr als 20xx interpretieren)\n`;
      prompt += `- Relative Angaben umrechnen (heutiges Datum verwenden als Referenz):\n`;
      prompt += `  - "morgen" → berechne morgiges Datum\n`;
      prompt += `  - "nächste Woche" → berechne Datum in einer Woche\n`;
      prompt += `  - "in 3 Tagen" → berechne Datum in 3 Tagen\n`;
      prompt += `- Monatsnamen erkennen: Januar, Februar, März, April, Mai, Juni, Juli, August, September, Oktober, November, Dezember\n`;
      prompt += `- Abgekürzte Monatsnamen: Jan, Feb, Mär, Apr, Mai, Jun, Jul, Aug, Sep, Okt, Nov, Dez\n`;
      prompt += `- Tag und Monat immer 2-stellig mit führender Null\n`;
      prompt += `- Bei ungültigen oder unklaren Eingaben: null zurückgeben\n`;
    } else if (field.datatype === 'uri' || field.datatype === 'url') {
      prompt += `\nFormat-Regeln für URLs:\n`;
      prompt += `- Muss mit http:// oder https:// beginnen\n`;
      prompt += `- Falls Protokoll fehlt: https:// hinzufügen\n`;
      prompt += `- Beispiele:\n`;
      prompt += `  - "example.com" → "https://example.com"\n`;
      prompt += `  - "www.uni-potsdam.de" → "https://www.uni-potsdam.de"\n`;
      prompt += `  - "http://example.com" → "http://example.com" (bleibt so)\n`;
      prompt += `- Bei ungültigen Eingaben (z.B. nur "test" ohne Domain): null zurückgeben\n`;
    }
    
    // Add vocabulary hints for label matching
    if (field.vocabulary && field.vocabulary.concepts.length > 0) {
      prompt += `\n**WICHTIG: Dieses Feld hat ein kontrolliertes Vokabular (${field.vocabulary.type} vocabulary)**\n\n`;
      prompt += `Verfügbare Labels (nutze EXAKT diese Schreibweise):\n`;
      field.vocabulary.concepts.forEach((concept, idx) => {
        // Clean label: Remove parentheses with explanations like "(auch: ...)"
        const cleanLabel = concept.label.replace(/\s*\(auch:.*?\)/gi, '').trim();
        prompt += `${idx + 1}. "${cleanLabel}"`;
        if (concept.altLabels && concept.altLabels.length > 0) {
          // Use different format to prevent AI from copying it
          prompt += ` [Alternativen: ${concept.altLabels.map(a => `"${a}"`).join(', ')}]`;
        }
        prompt += `\n`;
      });
      
      if (field.vocabulary.type === 'closed') {
        prompt += `\n⚠️ **CLOSED VOCABULARY** - NUR diese exakten Labels sind erlaubt!\n\n`;
        prompt += `**Deine Aufgabe:**\n`;
        prompt += `1. Analysiere die Benutzereingabe\n`;
        prompt += `2. Finde das ähnlichste Label aus der Liste (ignoriere Groß-/Kleinschreibung)\n`;
        prompt += `3. Gib EXAKT das Label aus der Liste zurück - OHNE Klammern, OHNE Erklärungen!\n`;
        prompt += `4. Korrigiere Tippfehler intelligent:\n`;
        prompt += `   - "CC BEI" → "CC BY" (ähnlich klingend)\n`;
        prompt += `   - "CK BY" → "CC BY" (Buchstabendreher)\n`;
        prompt += `   - "Tagugn" → "Tagung" (fehlende Buchstaben)\n`;
        prompt += `   - "Erziehungswissenschaften" → "Pädagogik" (erkenne Alternative)\n`;
        prompt += `5. Wenn KEIN passendes Label gefunden werden kann: Gib null zurück\n`;
        prompt += `6. Achte auf semantische Ähnlichkeit, nicht nur Buchstaben-Distanz\n\n`;
        prompt += `**KRITISCH - Ausgabe-Format:**\n`;
        prompt += `- Gib NUR das exakte Label zurück (in Anführungszeichen)\n`;
        prompt += `- KEINE eckigen Klammern [Alternativen: ...]\n`;
        prompt += `- KEINE runden Klammern oder Erklärungen\n`;
        prompt += `- KEINE zusätzlichen Texte\n`;
        prompt += `- Exakte Groß-/Kleinschreibung aus der Liste\n\n`;
        prompt += `**Beispiele:**\n`;
        prompt += `- Eingabe: "cc by-sa" → Ausgabe: "CC BY-SA"\n`;
        prompt += `- Eingabe: "Erziehungswissenschaften" → Ausgabe: "Pädagogik"\n`;
        prompt += `- Eingabe: "Politische Bildung" → Ausgabe: "Politik"\n`;
        prompt += `- Eingabe: "creative commons" → Ausgabe: null (zu ungenau)\n`;
      } else {
        prompt += `\n📖 Open/SKOS Vocabulary - Freie Eingabe erlaubt, aber bevorzuge Labels aus der Liste\n\n`;
        prompt += `**Deine Aufgabe:**\n`;
        prompt += `1. Wenn die Eingabe einem Label ähnelt: Korrigiere auf exaktes Label (nur das Label selbst!)\n`;
        prompt += `2. Wenn die Eingabe einem Alternative-Label entspricht: Nutze das Haupt-Label\n`;
        prompt += `3. Wenn die Eingabe komplett anders ist: Behalte Original-Wert\n`;
        prompt += `4. Gib NIEMALS eckige Klammern [Alternativen: ...] zurück!\n`;
      }
    }
    
    // Add validation pattern
    if (field.validation?.pattern) {
      prompt += `\nValidierungs-Muster: ${field.validation.pattern}\n`;
    }
    
    // Add user input
    prompt += `\n---\n\n`;
    if (Array.isArray(userInput)) {
      prompt += `**Benutzereingabe (Array):** ${JSON.stringify(userInput)}\n\n`;
      prompt += `**Aufgabe:** Normalisiere jedes Element des Arrays.\n\n`;
    } else {
      prompt += `**Benutzereingabe:** "${userInput}"\n\n`;
      prompt += `**Aufgabe:** Normalisiere diese Eingabe.\n\n`;
    }
    
    prompt += `**WICHTIG - Antwort-Format:**\n`;
    prompt += `Antworte NUR mit einem JSON-Wert, ohne zusätzlichen Text!\n`;
    prompt += `Verwende EXAKTE Groß-/Kleinschreibung aus der Vocabulary-Liste!\n\n`;
    
    if (Array.isArray(userInput)) {
      prompt += `Beispiel-Antwort:\n`;
      prompt += `\`\`\`json\n`;
      prompt += `["Normalisierter Wert 1", "Normalisierter Wert 2"]\n`;
      prompt += `\`\`\`\n`;
    } else {
      if (field.vocabulary) {
        prompt += `Beispiel-Antworten:\n`;
        prompt += `\`\`\`json\n`;
        prompt += `"CC BY"\n`;
        prompt += `\`\`\`\n`;
        prompt += `oder bei ungültigem Wert:\n`;
        prompt += `\`\`\`json\n`;
        prompt += `null\n`;
        prompt += `\`\`\`\n`;
      } else if (field.datatype === 'boolean') {
        prompt += `Beispiel-Antworten:\n`;
        prompt += `\`\`\`json\n`;
        prompt += `true\n`;
        prompt += `\`\`\`\n`;
        prompt += `oder:\n`;
        prompt += `\`\`\`json\n`;
        prompt += `false\n`;
        prompt += `\`\`\`\n`;
      } else if (field.datatype === 'number' || field.datatype === 'integer') {
        prompt += `Beispiel-Antworten:\n`;
        prompt += `\`\`\`json\n`;
        prompt += `10\n`;
        prompt += `\`\`\`\n`;
        prompt += `oder:\n`;
        prompt += `\`\`\`json\n`;
        prompt += `250\n`;
        prompt += `\`\`\`\n`;
      } else {
        prompt += `Beispiel-Antwort:\n`;
        prompt += `\`\`\`json\n`;
        prompt += `"normalisierter_wert"\n`;
        prompt += `\`\`\`\n`;
      }
    }
    
    return prompt;
  }

  /**
   * Parse normalization response from LLM
   */
  private parseNormalizationResponse(content: string, field: CanvasFieldState, originalValue: any): any {
    console.log(`🔍 Parsing response for ${field.fieldId}. Raw content:`, content.substring(0, 200));
    
    try {
      let jsonStr = content.trim();
      
      // Remove markdown code blocks if present
      const codeBlockMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
        console.log(`📦 Extracted from code block:`, jsonStr);
      }
      
      // Try to parse JSON directly
      let normalized: any;
      try {
        normalized = JSON.parse(jsonStr);
        console.log(`✅ Parsed JSON directly:`, normalized);
      } catch (parseError) {
        // Try to extract JSON patterns
        const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
        const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
        const stringMatch = jsonStr.match(/"([^"]+)"/);
        
        if (arrayMatch) {
          normalized = JSON.parse(arrayMatch[0]);
          console.log(`✅ Parsed from array match:`, normalized);
        } else if (objectMatch) {
          normalized = JSON.parse(objectMatch[0]);
          console.log(`✅ Parsed from object match:`, normalized);
        } else if (stringMatch) {
          normalized = stringMatch[1];
          console.log(`✅ Extracted quoted string:`, normalized);
        } else if (jsonStr.toLowerCase() === 'null') {
          normalized = null;
          console.log(`✅ Parsed as null`);
        } else if (!isNaN(Number(jsonStr))) {
          normalized = Number(jsonStr);
          console.log(`✅ Parsed as number:`, normalized);
        } else {
          console.warn(`⚠️ Could not parse response, using original value`);
          return originalValue;
        }
      }
      
      // Validate based on datatype
      if (field.datatype === 'boolean') {
        normalized = this.validateBoolean(normalized);
      } else if (field.datatype === 'number' || field.datatype === 'integer') {
        normalized = this.validateNumber(normalized);
      } else if (field.datatype === 'date') {
        normalized = this.validateDate(normalized);
      } else if (field.datatype === 'uri' || field.datatype === 'url') {
        normalized = this.validateUrl(normalized);
      }
      
      console.log(`📤 Final normalized value for ${field.fieldId}:`, normalized);
      return normalized;
      
    } catch (error) {
      console.error(`❌ Failed to parse normalization response:`, error);
      console.error(`❌ Content was:`, content);
    }
    
    // Return original value if parsing fails
    console.log(`🔄 Fallback to original value:`, originalValue);
    return originalValue;
  }

  /**
   * Validate boolean value
   */
  private validateBoolean(value: any): boolean | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    
    // Try to parse from string
    if (typeof value === 'string') {
      const str = value.toLowerCase().trim();
      if (str === 'true' || str === 'ja' || str === 'yes') return true;
      if (str === 'false' || str === 'nein' || str === 'no') return false;
    }
    
    // Try to parse from number
    if (typeof value === 'number') {
      return value !== 0;
    }
    
    return null;
  }

  /**
   * Validate number value
   */
  private validateNumber(value: any): number | null {
    if (value === null || value === undefined) return null;
    
    // If already a number, return it
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }
    
    // Try to parse from string
    if (typeof value === 'string') {
      const num = Number(value.trim());
      return isNaN(num) ? null : num;
    }
    
    return null;
  }

  /**
   * Validate date value and ensure ISO format
   */
  private validateDate(value: any): string | null {
    if (!value || typeof value !== 'string') return null;
    
    const str = value.trim();
    
    // Check if already in YYYY-MM-DD format
    const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (isoRegex.test(str)) {
      // Additional validation: Check if it's a valid date
      const parts = str.split('-');
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const day = parseInt(parts[2]);
      
      const testDate = new Date(year, month - 1, day);
      if (testDate.getFullYear() === year && 
          testDate.getMonth() === month - 1 && 
          testDate.getDate() === day) {
        return str;
      } else {
        console.warn(`⚠️ Invalid ISO date: ${str}`);
        return null;
      }
    }
    
    // Try to parse and convert (as fallback)
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const isoDate = `${year}-${month}-${day}`;
      console.log(`🔄 Converted date via Date parser: "${str}" → "${isoDate}"`);
      return isoDate;
    }
    
    console.warn(`⚠️ Could not validate date: "${str}"`);
    return null;
  }

  /**
   * Validate URL value
   */
  private validateUrl(value: any): string | null {
    if (!value || typeof value !== 'string') return null;
    
    // Check if valid URL
    try {
      const url = new URL(value);
      return url.toString();
    } catch {
      // Try adding https://
      try {
        const url = new URL(`https://${value}`);
        return url.toString();
      } catch {
        return null;
      }
    }
  }

  /**
   * Validate vocabulary value (label matching)
   */
  private validateVocabulary(value: any, field: CanvasFieldState): any {
    if (!value || !field.vocabulary) return value;

    const concepts = field.vocabulary.concepts;
    // Treat both 'closed' and 'skos' as controlled vocabularies
    const isClosed = field.vocabulary.type === 'closed' || field.vocabulary.type === 'skos';

    console.log(`📋 Vocabulary type: ${field.vocabulary.type} (treating as closed: ${isClosed})`);

    // Handle arrays
    if (Array.isArray(value)) {
      console.log(`🔍 Validating array with ${value.length} items (closed: ${isClosed})`);
      const validated = value.map(v => this.validateSingleLabel(v, concepts, isClosed));
      
      // Filter out null values for controlled vocabularies
      if (isClosed) {
        const filtered = validated.filter(v => v !== null);
        const removedCount = validated.length - filtered.length;
        if (removedCount > 0) {
          console.warn(`⚠️ Removed ${removedCount} invalid value(s) from ${field.vocabulary.type} vocabulary array`);
          console.warn(`   Invalid values:`, value.filter((v, i) => validated[i] === null));
        }
        return filtered;
      }
      
      return validated;
    }

    // Handle single value
    return this.validateSingleLabel(value, concepts, isClosed);
  }

  /**
   * Validate single label against vocabulary
   */
  private validateSingleLabel(value: string, concepts: any[], isClosed: boolean): string | null {
    if (!value || typeof value !== 'string') return null;

    const valueLower = value.toLowerCase().trim();
    console.log(`🔍 Validating "${value}" against ${concepts.length} concepts (closed: ${isClosed})`);

    // 1. Check exact match (case-insensitive)
    const exactMatch = concepts.find(c => 
      c.label.toLowerCase() === valueLower ||
      c.altLabels?.some((alt: string) => alt.toLowerCase() === valueLower)
    );

    if (exactMatch) {
      console.log(`✅ Exact match: "${value}" → "${exactMatch.label}"`);
      return exactMatch.label;
    }

    // 2. Normalize value (remove special chars, extra spaces)
    const normalizedValue = valueLower.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(`🔧 Normalized input: "${value}" → "${normalizedValue}"`);

    // 3. Check normalized exact match
    const normalizedMatch = concepts.find(c => {
      const normalizedLabel = c.label.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
      return normalizedLabel === normalizedValue;
    });

    if (normalizedMatch) {
      console.log(`✅ Normalized exact match: "${value}" → "${normalizedMatch.label}"`);
      return normalizedMatch.label;
    }

    // 4. Try fuzzy matching (for closed AND skos vocabularies)
    // SKOS vocabularies are also controlled, so we validate them strictly
    if (isClosed) {
      const fuzzyMatch = this.findFuzzyMatch(normalizedValue, concepts);
      if (fuzzyMatch) {
        console.log(`🔧 Fuzzy match: "${value}" → "${fuzzyMatch.label}" (distance: ${fuzzyMatch.distance})`);
        return fuzzyMatch.label;
      }
      
      console.warn(`⚠️ No match in controlled vocabulary for: "${value}"`);
      return null;
    }

    // For truly open vocabulary: Keep original value
    console.log(`ℹ️ No match in open vocabulary, keeping original: "${value}"`);
    return value;
  }

  /**
   * Find fuzzy match using Levenshtein distance
   * Returns best match if distance is small enough
   */
  private findFuzzyMatch(value: string, concepts: any[]): { label: string; distance: number } | null {
    let bestMatch: { label: string; distance: number } | null = null as { label: string; distance: number } | null;

    concepts.forEach(concept => {
      // Normalize label for comparison (remove special chars)
      const label = concept.label.toLowerCase();
      const normalizedLabel = label.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
      
      // Calculate distance for both original and normalized
      const distance = this.levenshteinDistance(value, normalizedLabel);
      
      // Also check altLabels
      const altDistances = (concept.altLabels || []).map((alt: string) => {
        const normalizedAlt = alt.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
        return this.levenshteinDistance(value, normalizedAlt);
      });
      const minAltDistance = altDistances.length > 0 ? Math.min(...altDistances) : Infinity;
      const minDistance = Math.min(distance, minAltDistance);

      console.log(`  📏 Distance to "${concept.label}": ${minDistance} (normalized: "${normalizedLabel}")`);

      // Keep best match (lowest distance)
      if (!bestMatch || minDistance < bestMatch.distance) {
        bestMatch = { label: concept.label, distance: minDistance };
      }
    });

    // Only accept if distance is small (max 2-3 characters difference)
    // This catches typos like "CC PY" → "CC BY" (distance = 1)
    const maxDistance = Math.min(3, Math.ceil(value.length * 0.3)); // Max 30% difference
    
    console.log(`  🎯 Best match: "${bestMatch?.label}" with distance ${bestMatch?.distance}, max allowed: ${maxDistance}`);
    
    if (bestMatch && bestMatch.distance <= maxDistance) {
      return bestMatch;
    }

    return null;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * (minimum number of edits to transform one string into another)
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}
