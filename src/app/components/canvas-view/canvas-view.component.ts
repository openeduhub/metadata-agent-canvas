import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EduSharingLlmService } from 'ngx-edu-sharing-b-api';
import { CanvasService } from '../../services/canvas.service';
import { SchemaLoaderService } from '../../services/schema-loader.service';
import { IntegrationModeService } from '../../services/integration-mode.service';
import { GuestSubmissionService } from '../../services/guest-submission.service';
import { I18nService } from '../../services/i18n.service';
import { CanvasState, FieldGroup, FieldStatus } from '../../models/canvas-models';
import { CanvasFieldComponent } from '../canvas-field/canvas-field.component';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';
import { JsonLoaderComponent, LoadedJsonData } from '../json-loader/json-loader.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-canvas-view',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, CanvasFieldComponent, LanguageSwitcherComponent, JsonLoaderComponent],
  templateUrl: './canvas-view.component.html',
  styleUrls: ['./canvas-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CanvasViewComponent implements OnInit, OnDestroy {
  state: CanvasState;
  userText = '';
  FieldStatus = FieldStatus;
  showContentTypeDropdown = false;
  isSubmitting = false;
  contentTypeOptions: Array<{ label: string; schemaFile: string }> = [];
  llmProvider = environment.llmProvider; // Active LLM provider
  llmModel = this.getActiveLlmModel(); // Active LLM model
  
  private destroy$ = new Subject<void>();
  private savedScrollPosition = 0;

  constructor(
    private canvasService: CanvasService,
    private schemaLoader: SchemaLoaderService,
    private cdr: ChangeDetectorRef,
    private eduSharingLlmService: EduSharingLlmService,
    public integrationMode: IntegrationModeService,
    private guestSubmission: GuestSubmissionService,
    public i18n: I18nService
  ) {
    this.state = this.canvasService.getCurrentState();
  }

  ngOnInit(): void {
    console.log('🚀 CanvasView ngOnInit started');
    
    // Pre-load core schema (non-blocking - runs in background)
    this.canvasService.ensureCoreSchemaLoaded();
    
    // Subscribe to state changes
    this.canvasService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.state = state;
        // Manually trigger change detection with OnPush strategy
        this.cdr.markForCheck();
      });
    
    console.log('📡 Setting up language change subscription...');
    
    // Subscribe to language changes to re-localize fields
    this.i18n.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (language) => {
        console.log(`🔔 Language Observable fired: ${language}`);

        console.log(`🌐 Language changed to: ${language}, re-localizing fields...`);
        
        // Re-localize all fields
        await this.relocalizeFields(language);
        
        // Explicitly get updated state (important for OnPush)
        const newState = this.canvasService.getCurrentState();
        
        console.log(`📝 Updating component state with new field references...`);
        console.log(`   Core field 0 label: ${newState.coreFields[0]?.label}`);
        console.log(`   Group 0 label: ${newState.fieldGroups[0]?.label}`);
        console.log(`   Group 0 field 0 label: ${newState.fieldGroups[0]?.fields[0]?.label}`);
        
        // Force Angular to recognize the change by reassigning
        this.state = {
          ...newState,
          coreFields: [...newState.coreFields],
          specialFields: [...newState.specialFields],
          fieldGroups: newState.fieldGroups.map(g => ({
            ...g,
            fields: [...g.fields]
          }))
        };
        
        // Update content type dropdown options
        this.updateContentTypeOptions();
        
        // Use setTimeout to ensure change detection runs after state assignment
        setTimeout(() => {
          console.log(`🔄 Triggering change detection...`);
          this.cdr.detectChanges();
          console.log(`✅ UI updated with ${language} labels`);
        }, 0);
      });
    
    // Listen for postMessage from parent window (test integration)
    this.setupPostMessageListener();
    
    // Auto-start extraction if we have page data from integration
    this.handleIntegrationMode();
  }
  
  /**
   * Handle integration mode (Browser Extension or Bookmarklet)
   */
  private async handleIntegrationMode(): Promise<void> {
    const pageData = this.integrationMode.getPageData();
    
    if (pageData && pageData.content) {
      console.log('🚀 Auto-starting extraction from integration mode');
      
      // Pre-fill text area
      this.userText = pageData.content;
      this.cdr.detectChanges();
      
      // Auto-start extraction
      await this.startExtraction();
    }
  }
  
  /**
   * Setup postMessage listener for external integration
   */
  private setupPostMessageListener(): void {
    window.addEventListener('message', (event) => {
      // Log incoming message for debugging
      console.log('📬 postMessage received from:', event.origin, 'Type:', event.data?.type);
      
      // Security: Accept messages from any HTTPS origin or localhost (for bookmarklet usage)
      const isSecureOrigin = event.origin.startsWith('https://') || 
                             event.origin.includes('localhost') ||
                             event.origin.includes('127.0.0.1');
      
      if (!isSecureOrigin) {
        console.warn('⚠️ Message from untrusted origin rejected:', event.origin);
        return;
      }
      
      // Handle legacy SET_TEXT (backward compatibility)
      if (event.data.type === 'SET_TEXT' && event.data.text) {
        console.log('📨 Received text via postMessage (legacy):', event.data.text.substring(0, 100) + '...');
        
        // Set text in textarea
        this.userText = event.data.text;
        
        // Trigger change detection
        this.cdr.detectChanges();
        
        // Send confirmation back
        if (event.source) {
          (event.source as Window).postMessage({
            type: 'TEXT_RECEIVED',
            success: true
          }, event.origin);
        }
        
        console.log('✅ Text successfully set in canvas textarea');
      }
      
      // Handle structured SET_PAGE_DATA (bookmarklet/plugin with URL and structured data)
      if (event.data.type === 'SET_PAGE_DATA' && event.data.text) {
        console.log('📨 Received page data via postMessage:');
        console.log('  - URL:', event.data.url);
        console.log('  - Title:', event.data.pageTitle);
        console.log('  - Mode:', event.data.mode);
        
        // Log structured data availability
        const pageData = event.data.pageData || event.data.structuredData || {};
        console.log('  - Has JSON-LD:', !!pageData.structuredData || !!pageData.jsonLd);
        console.log('  - Has Schema.org:', !!pageData.schemaOrg);
        console.log('  - Has Dublin Core:', !!pageData.dublinCore?.title);
        console.log('  - Has LRMI:', !!pageData.lrmi?.educationalUse);
        console.log('  - Has License:', !!pageData.license);
        console.log('  - Has Breadcrumbs:', !!pageData.breadcrumbs);
        console.log('  - Has Tags:', !!pageData.tags);
        
        // Update mode if specified
        if (event.data.mode) {
          this.integrationMode.setMode(event.data.mode);
        }
        
        // Set text in textarea
        this.userText = event.data.text;
        
        // Store URL for later use (will be pre-filled in metadata)
        if (event.data.url) {
          sessionStorage.setItem('canvas_page_url', event.data.url);
        }
        
        // Store page title
        if (event.data.pageTitle) {
          sessionStorage.setItem('canvas_page_title', event.data.pageTitle);
        }
        
        // Store complete page data for extraction enhancement
        if (pageData && Object.keys(pageData).length > 0) {
          sessionStorage.setItem('canvas_page_data', JSON.stringify(pageData));
          console.log('📦 Stored complete page data with', Object.keys(pageData).length, 'categories');
        }
        
        // Backward compatibility: also store old structuredData format
        if (event.data.structuredData) {
          sessionStorage.setItem('canvas_structured_data', JSON.stringify(event.data.structuredData));
        }
        
        // Trigger change detection
        this.cdr.detectChanges();
        
        // Send confirmation back
        if (event.source) {
          (event.source as Window).postMessage({
            type: 'PAGE_DATA_RECEIVED',
            success: true
          }, event.origin);
        }
        
        console.log('✅ Page data successfully set in canvas');
      }
      
      // Handle PLUGIN_PAGE_DATA (Browser-Plugin with page extraction)
      if (event.data.type === 'PLUGIN_PAGE_DATA') {
        console.log('📨 Received page data from Browser Plugin:');
        console.log('  - URL:', event.data.url);
        console.log('  - Title:', event.data.title);
        console.log('  - Mode:', event.data.mode);
        
        // Update mode to browser-extension
        if (event.data.mode === 'browser-extension') {
          this.integrationMode.setMode('browser-extension');
        }
        
        // Set text in textarea (use text or html)
        this.userText = event.data.text || event.data.html;
        
        // Store URL for later use
        if (event.data.url) {
          sessionStorage.setItem('canvas_page_url', event.data.url);
        }
        
        // Store metadata if provided
        if (event.data.metadata) {
          sessionStorage.setItem('canvas_plugin_metadata', JSON.stringify(event.data.metadata));
        }
        
        // Trigger change detection
        this.cdr.detectChanges();
        
        // Send confirmation back to plugin
        if (event.source) {
          (event.source as Window).postMessage({
            type: 'PLUGIN_DATA_RECEIVED',
            success: true
          }, event.origin);
        }
        
        console.log('✅ Plugin page data successfully set in canvas');
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Start extraction
   */
  async startExtraction(): Promise<void> {
    if (!this.userText.trim()) {
      alert(this.i18n.instant('ALERTS.INPUT_REQUIRED'));
      return;
    }

    await this.canvasService.startExtraction(this.userText);
  }

  /**
   * Handle field change
   */
  onFieldChange(event: { fieldId: string; value: any }): void {
    // Save current scroll position
    this.saveScrollPosition();
    
    // Update field value
    this.canvasService.updateFieldValue(event.fieldId, event.value);
    
    // Restore scroll position after change detection
    setTimeout(() => this.restoreScrollPosition(), 0);
  }
  
  /**
   * Save current scroll position
   */
  private saveScrollPosition(): void {
    const canvasContent = document.querySelector('.canvas-content');
    if (canvasContent) {
      this.savedScrollPosition = canvasContent.scrollTop;
    }
  }
  
  /**
   * Restore saved scroll position
   */
  private restoreScrollPosition(): void {
    const canvasContent = document.querySelector('.canvas-content');
    if (canvasContent && this.savedScrollPosition > 0) {
      canvasContent.scrollTop = this.savedScrollPosition;
    }
  }

  /**
   * Get content type group (special styling)
   */
  getContentTypeGroup(): FieldGroup | null {
    return this.state.fieldGroups.find(g => 
      g.fields.some(f => f.fieldId === 'ccm:oeh_flex_lrt')
    ) || null;
  }

  /**
   * Get other groups (excluding content type)
   */
  getOtherGroups(): FieldGroup[] {
    return this.state.fieldGroups.filter(g => 
      !g.fields.some(f => f.fieldId === 'ccm:oeh_flex_lrt')
    );
  }

  /**
   * Check if all required fields are filled
   */
  allRequiredFieldsFilled(): boolean {
    const allFields = [...this.state.coreFields, ...this.state.specialFields];
    const requiredFields = allFields.filter(f => f.isRequired);
    return requiredFields.every(f => f.status === FieldStatus.FILLED);
  }

  /**
   * Get required fields count
   */
  getRequiredFieldsStatus(): { filled: number; total: number } {
    const allFields = [...this.state.coreFields, ...this.state.specialFields];
    const requiredFields = allFields.filter(f => f.isRequired);
    const filledRequired = requiredFields.filter(f => f.status === FieldStatus.FILLED);
    
    return {
      filled: filledRequired.length,
      total: requiredFields.length
    };
  }

  /**
   * Get optional fields count
   */
  getOptionalFieldsStatus(): { filled: number; total: number } {
    const allFields = [...this.state.coreFields, ...this.state.specialFields];
    const optionalFields = allFields.filter(f => !f.isRequired);
    const filledOptional = optionalFields.filter(f => f.status === FieldStatus.FILLED);
    
    return {
      filled: filledOptional.length,
      total: optionalFields.length
    };
  }

  /**
   * Confirm and export (mode-aware)
   */
  confirmAndExport(): void {
    if (!this.allRequiredFieldsFilled()) {
      const status = this.getRequiredFieldsStatus();
      alert(this.i18n.instant('ALERTS.REQUIRED_FIELDS_STATUS', { filled: status.filled, total: status.total }));
      return;
    }

    // Geocoding already happened automatically after extraction
    
    if (this.integrationMode.isBrowserExtension() || this.integrationMode.isBookmarklet()) {
      // Send metadata back to parent (Extension or Bookmarklet)
      this.sendMetadataToParent();
    } else {
      // Standalone mode: Download JSON
      this.downloadJson();
    }
  }
  
  /**
   * Send metadata to parent window (Extension or Bookmarklet)
   */
  private sendMetadataToParent(): void {
    // For Browser-Extension: Use Repository-API format (URI strings, not {label, uri} objects)
    // For Bookmarklet: Use enriched format with {label, uri}
    const metadata = this.integrationMode.isBrowserExtension()
      ? this.canvasService.getMetadataForPlugin()
      : JSON.parse(this.canvasService.getMetadataJson());
    
    this.integrationMode.sendMetadataToParent(metadata);
    
    // Show success message
    alert(this.integrationMode.isLoggedIn() 
      ? this.i18n.instant('ALERTS.METADATA_SENT')
      : this.i18n.instant('ALERTS.SUGGESTION_SUBMITTED'));
  }
  
  /**
   * Close canvas (for integration modes)
   */
  closeCanvas(): void {
    this.integrationMode.requestClose();
  }
  
  /**
   * Submit metadata (mode-dependent)
   */
  async submitAsGuest(): Promise<void> {
    if (!this.allRequiredFieldsFilled()) {
      alert(this.i18n.instant('ALERTS.FILL_REQUIRED_FIELDS'));
      return;
    }
    
    this.isSubmitting = true;
    this.cdr.detectChanges();
    
    try {
      const json = this.canvasService.getMetadataJson();
      const metadata = JSON.parse(json);
      
      // BROWSER-EXTENSION MODE: Send to plugin via postMessage
      if (this.integrationMode.isBrowserExtension()) {
        console.log('📤 Sending metadata to Browser-Plugin...');
        
        // Use Repository-API format (URI strings, not {label, uri} objects)
        const pluginMetadata = this.canvasService.getMetadataForPlugin();
        
        // Debug: Log essential fields that Plugin will use for createNode
        console.log('🔍 Essential fields for createNode:', {
          'cclom:title': pluginMetadata['cclom:title'],
          'cclom:general_description': pluginMetadata['cclom:general_description'],
          'cclom:general_keyword': pluginMetadata['cclom:general_keyword'],
          'ccm:wwwurl': pluginMetadata['ccm:wwwurl'],
          'cclom:general_language': pluginMetadata['cclom:general_language']
        });
        
        this.integrationMode.sendMetadataToParent(pluginMetadata);
        
        // Show success message
        alert(this.i18n.instant('ALERTS.PLUGIN.SENT') + '\n\n' + this.i18n.instant('ALERTS.PLUGIN.MESSAGE'));
        
        // Close canvas after short delay
        setTimeout(() => {
          this.integrationMode.requestClose();
        }, 1500);
        
        this.isSubmitting = false;
        return;
      }
      
      // STANDALONE/BOOKMARKLET MODE: Submit to Netlify Functions
      console.log('📤 Submitting as guest to repository...');
      const result = await this.guestSubmission.submitAsGuest(metadata);
      
      if (result.success && result.nodeId) {
        // SUCCESS - Show custom dialog with clickable link
        this.showSuccessDialog(result.nodeId);
        
        // Optional: Reset after success
        setTimeout(() => {
          if (confirm(this.i18n.instant('ALERTS.SUBMIT_AGAIN'))) {
            this.reset();
          }
        }, 500);
      } else if (result.duplicate) {
        // DUPLICATE
        const viewInRepo = confirm(
          this.i18n.instant('ALERTS.DUPLICATE.TITLE') + '\n\n' + 
          result.error + '\n\n' + 
          this.i18n.instant('ALERTS.DUPLICATE.NODE_ID') + ' ' + result.nodeId + '\n\n' + 
          this.i18n.instant('ALERTS.VIEW_IN_REPO')
        );
        
        if (viewInRepo && result.nodeId) {
          const repoUrl = `${environment.repository.baseUrl}/components/render/${result.nodeId}`;
          window.open(repoUrl, '_blank');
        }
      } else {
        // ERROR
        alert(
          this.i18n.instant('ALERTS.ERROR.SUBMISSION_ERROR') + '\n\n' +
          (result.error || 'Unknown Error') + '\n\n' +
          this.i18n.instant('ALERTS.ERROR.TRY_AGAIN')
        );
      }
    } catch (error) {
      console.error('Submission error:', error);
      alert(
        this.i18n.instant('ALERTS.ERROR.TECHNICAL_ERROR') + '\n\n' +
        this.i18n.instant('ALERTS.ERROR.DETAILS') + ' ' +
        (error instanceof Error ? error.message : 'Unknown')
      );
    } finally {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Download JSON file
   */
  downloadJson(): void {
    const jsonData = this.canvasService.exportAsJson();
    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `metadata_${Date.now()}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Show success dialog with clickable link to repository
   */
  showSuccessDialog(nodeId: string): void {
    const repoUrl = `${environment.repository.baseUrl}/components/render/${nodeId}`;
    
    // Create modal HTML with translations
    const dialogHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;">
        <div style="background: white; padding: 30px; border-radius: 8px; max-width: 500px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="margin: 0 0 20px 0; color: #28a745;">${this.i18n.instant('ALERTS.SUCCESS.TITLE')}</h2>
          
          <p style="margin-bottom: 15px;">${this.i18n.instant('ALERTS.SUCCESS.MESSAGE')}</p>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
            <p style="margin: 0 0 10px 0;"><strong>${this.i18n.instant('ALERTS.SUCCESS.NODE_ID')}</strong></p>
            <a href="${repoUrl}" target="_blank" style="color: #007bff; text-decoration: none; word-break: break-all; font-family: monospace;">${nodeId}</a>
            <p style="margin: 15px 0 0 0;"><strong>${this.i18n.instant('ALERTS.SUCCESS.STATUS')}</strong></p>
            <p style="margin: 10px 0 0 0;"><strong>${this.i18n.instant('ALERTS.SUCCESS.REPOSITORY')}</strong></p>
          </div>
          
          <p style="margin-bottom: 20px;">${this.i18n.instant('ALERTS.SUCCESS.THANK_YOU')}</p>
          
          <div style="display: flex; gap: 10px;">
            <a href="${repoUrl}" target="_blank" style="flex: 1; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; text-align: center;">
              ${this.i18n.instant('ALERTS.SUCCESS.VIEW_IN_REPO_BTN')}
            </a>
            <button onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="flex: 1; background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">
              ${this.i18n.instant('HEADER.CLOSE')}
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Insert dialog into DOM
    const dialogElement = document.createElement('div');
    dialogElement.innerHTML = dialogHTML;
    document.body.appendChild(dialogElement.firstElementChild!);
  }

  /**
   * Reset canvas
   */
  reset(): void {
    if (confirm(this.i18n.instant('ALERTS.RESET_CONFIRM'))) {
      this.userText = '';
      this.canvasService.reset();
    }
  }

  /**
   * Get progress percentage
   */
  getProgressPercentage(): number {
    if (this.state.totalFields === 0) return 0;
    return Math.round((this.state.filledFields / this.state.totalFields) * 100);
  }

  /**
   * Get progress emoji based on percentage (Gamification)
   */
  getProgressEmoji(): string {
    const percentage = this.getProgressPercentage();
    
    if (percentage === 100) return '🎉';      // Party - Alles fertig!
    if (percentage >= 80) return '😊';        // Happy - Fast fertig
    if (percentage >= 60) return '🙂';        // Smile - Guter Fortschritt
    if (percentage >= 40) return '😐';        // Neutral - Hälfte geschafft
    if (percentage >= 20) return '😕';        // Unsicher - Noch viel zu tun
    return '😴';                               // Sleepy - Gerade gestartet
  }

  /**
   * Get content type label
   */
  getContentTypeLabel(): string {
    const currentLang = this.i18n.getCurrentLanguage();
    
    // First, try to get from metadata if available (from imported JSON)
    const metadata = this.state.metadata['ccm:oeh_flex_lrt'];
    if (metadata && typeof metadata === 'object') {
      // Extract label based on current language
      if (metadata.label && typeof metadata.label === 'object') {
        return metadata.label[currentLang] || metadata.label['de'] || metadata.label['en'] || '';
      } else if (typeof metadata.label === 'string') {
        return metadata.label;
      }
    }
    
    // Second, try to get from concept (already localized by SchemaLoader)
    const concept = this.canvasService.getContentTypeConcept();
    if (concept && concept.label) {
      // Concept labels from SchemaLoader are already localized strings or objects
      if (typeof concept.label === 'object') {
        return concept.label[currentLang] || concept.label['de'] || concept.label['en'] || '';
      }
      return concept.label;
    }

    // Fallback: use SchemaLoader to get label by schema file
    if (this.state.selectedContentType || this.state.detectedContentType) {
      const schemaFile = this.state.selectedContentType || this.state.detectedContentType;
      return this.schemaLoader.getContentTypeLabel(schemaFile!);
    }

    return this.i18n.instant('CONTENT_TYPE.NOT_DETECTED');
  }

  /**
   * Get content type icon
   */
  getContentTypeIcon(): string {
    if (!this.state.selectedContentType && !this.state.detectedContentType) {
      return '';
    }

    const schemaFile = this.state.selectedContentType || this.state.detectedContentType;
    
    // Try to get from SchemaLoader directly (more reliable)
    const concepts = this.schemaLoader.getContentTypeConcepts();
    const concept = concepts.find(c => c.schema_file === schemaFile);
    
    if (concept?.icon) {
      return concept.icon;
    }
    
    // Fallback: Try from field vocabulary
    const contentTypeField = this.state.coreFields.find(f => f.fieldId === 'ccm:oeh_flex_lrt');
    if (contentTypeField?.vocabulary) {
      const vocabConcept = contentTypeField.vocabulary.concepts.find(c => c.schema_file === schemaFile);
      return vocabConcept?.icon || '';
    }
    
    return '';
  }

  /**
   * Get content type tooltip with confidence and reason
   */
  getContentTypeTooltip(): string {
    const confidence = Math.round(this.state.contentTypeConfidence * 100);
    const reason = this.state.contentTypeReason || 'Automatisch erkannt';
    
    return `Confidence: ${confidence}%\n${reason}`;
  }

  /**
   * Get filled fields count for a group
   */
  getFilledFieldsCount(group: FieldGroup): number {
    return group.fields.filter(f => f.status === FieldStatus.FILLED).length;
  }

  /**
   * Get field counts by required/optional for a group
   */
  getGroupFieldCounts(group: FieldGroup): {
    requiredFilled: number;
    requiredTotal: number;
    optionalFilled: number;
    optionalTotal: number;
  } {
    const requiredFields = group.fields.filter(f => f.isRequired);
    const optionalFields = group.fields.filter(f => !f.isRequired);

    return {
      requiredFilled: requiredFields.filter(f => f.status === FieldStatus.FILLED).length,
      requiredTotal: requiredFields.length,
      optionalFilled: optionalFields.filter(f => f.status === FieldStatus.FILLED).length,
      optionalTotal: optionalFields.length
    };
  }

  /**
   * Toggle content type dropdown
   */
  changeContentType(): void {
    console.log('🔧 changeContentType called');
    
    // Search in ALL fields (core + special)
    const allFields = [...this.state.coreFields, ...this.state.specialFields];
    console.log('All field IDs:', allFields.map(f => f.fieldId));
    
    const contentTypeField = allFields.find(f => f.fieldId === 'ccm:oeh_flex_lrt');
    console.log('Content type field:', contentTypeField);
    
    if (!contentTypeField) {
      console.warn('⚠️ Content type field not found in any field list!');
      console.warn('Available fields:', allFields.map(f => f.fieldId));
      
      // Fallback: Load options directly from schema loader
      this.loadContentTypeOptionsFromSchema();
      return;
    }
    
    if (!contentTypeField.vocabulary) {
      console.warn('⚠️ No vocabulary found on content type field!');
      this.loadContentTypeOptionsFromSchema();
      return;
    }

    console.log('Vocabulary concepts:', contentTypeField.vocabulary.concepts);

    // Load content type options from vocabulary
    this.contentTypeOptions = contentTypeField.vocabulary.concepts.map((concept: any) => ({
      label: concept.label,
      schemaFile: concept.schema_file || ''
    }));

    console.log('Content type options:', this.contentTypeOptions);

    // Toggle dropdown
    this.showContentTypeDropdown = !this.showContentTypeDropdown;
    console.log('Dropdown visible:', this.showContentTypeDropdown);
  }

  /**
   * Fallback: Load content type options directly from schema loader
   */
  private loadContentTypeOptionsFromSchema(): void {
    console.log('📦 Loading content type options from schema loader');
    
    // Get core schema
    const coreSchema = this.schemaLoader.getCoreSchema();
    if (!coreSchema || !coreSchema.fields) {
      console.error('❌ Core schema not loaded!');
      return;
    }

    // Find content type field definition
    const contentTypeFieldDef = coreSchema.fields.find((f: any) => f.id === 'ccm:oeh_flex_lrt');
    if (!contentTypeFieldDef || !contentTypeFieldDef.system?.vocabulary) {
      console.error('❌ Content type field definition not found in schema!');
      return;
    }

    console.log('✅ Found content type field in schema:', contentTypeFieldDef);

    // Load options from schema
    this.contentTypeOptions = contentTypeFieldDef.system.vocabulary.concepts.map((concept: any) => ({
      label: concept.label,
      schemaFile: concept.schema_file || ''
    }));

    console.log('✅ Loaded content type options:', this.contentTypeOptions);

    // Show dropdown
    this.showContentTypeDropdown = true;
  }

  /**
   * Select a content type from dropdown
   */
  async selectContentType(option: { label: string; schemaFile: string }): Promise<void> {
    console.log('📝 Content type selected:', option);
    console.log('Schema file to load:', option.schemaFile);
    
    // Close dropdown
    this.showContentTypeDropdown = false;
    
    // Update field value first
    this.onFieldChange({ fieldId: 'ccm:oeh_flex_lrt', value: option.label });
    
    // Trigger schema reload and re-extraction
    console.log('🔄 Triggering schema reload for:', option.schemaFile);
    await this.canvasService.changeContentTypeManually(option.schemaFile);
  }

  /**
   * Close dropdown when clicking outside
   */
  closeContentTypeDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.showContentTypeDropdown = false;
  }
  
  /**
   * Re-localize all fields when language changes
   */
  private async relocalizeFields(language: 'de' | 'en'): Promise<void> {
    // Reload fields with new language
    await this.canvasService.relocalizeAllFields(language);
  }
  
  /**
   * Update content type dropdown options with localized labels
   */
  private updateContentTypeOptions(): void {
    const availableSchemas = this.schemaLoader.getAvailableSpecialSchemas();
    this.contentTypeOptions = availableSchemas.map(schemaFile => ({
      label: this.schemaLoader.getContentTypeLabel(schemaFile),
      schemaFile: schemaFile
    }));
  }
  
  /**
   * Get active LLM model based on provider
   */
  private getActiveLlmModel(): string {
    const provider = environment.llmProvider;
    if (provider === 'b-api-openai') {
      return (environment as any).bApiOpenai?.model || 'gpt-4.1-mini';
    } else if (provider === 'b-api-academiccloud') {
      return (environment as any).bApiAcademicCloud?.model || 'deepseek-r1';
    } else {
      return environment.openai?.model || 'gpt-4.1-mini';
    }
  }
  
  /**
   * TrackBy function for field groups (performance optimization)
   * Use only schemaName and id to keep component instance consistent
   */
  trackByGroupId(index: number, group: FieldGroup): string {
    return `${group.schemaName}::${group.id}`;
  }
  
  /**
   * TrackBy function for fields (performance optimization)
   * Use only fieldId to keep component instance, let ngOnChanges handle updates
   */
  trackByFieldId(index: number, field: any): string {
    return field.fieldId;
  }

  /**
   * Handle JSON file loaded
   */
  async onJsonLoaded(data: LoadedJsonData): Promise<void> {
    console.log('📂 JSON loaded:', data);
    
    try {
      await this.canvasService.importJsonData(data.metadata, data.detectedSchema);
      
      const currentLanguage = this.i18n.getCurrentLanguage();
      
      // Try to get content type info from imported JSON directly
      let contentTypeLabel = this.i18n.instant('CONTENT_TYPE.NOT_DETECTED');
      let schemaFile = data.detectedSchema || 'Standard';
      
      const contentTypeField = data.metadata['ccm:oeh_flex_lrt'];
      if (contentTypeField && typeof contentTypeField.value === 'object') {
        const metadata = contentTypeField.value;
        
        // Extract label based on current language
        if (metadata.displayLabel && typeof metadata.displayLabel === 'string') {
          contentTypeLabel = metadata.displayLabel;
        } else if (metadata.label && typeof metadata.label === 'object') {
          // Get label for current language from multilingual object
          contentTypeLabel = metadata.label[currentLanguage] || metadata.label['de'] || metadata.label['en'] || contentTypeLabel;
        } else if (typeof metadata.label === 'string') {
          contentTypeLabel = metadata.label;
        }
        
        schemaFile = metadata.schema_file || schemaFile;
      } else {
        // Fallback: try to get from service (for older exports)
        const contentType = this.canvasService.getContentTypeConcept();
        if (contentType) {
          contentTypeLabel = contentType.label;
          schemaFile = contentType.schema_file || schemaFile;
        }
      }
      
      alert(`✅ JSON erfolgreich geladen!\n\n${data.fileName}\nSchema: ${schemaFile}\nInhaltsart: ${contentTypeLabel}\nSprache: ${currentLanguage}`);
      this.cdr.detectChanges();
    } catch (error) {
      console.error('❌ Error loading JSON:', error);
      alert('❌ Fehler beim Laden der JSON-Datei:\n' + (error as Error).message);
    }
  }

  /**
   * Check if metadata can be submitted (all required fields filled)
   */
  canSubmit(): boolean {
    const allFields = [...this.state.coreFields, ...this.state.specialFields];
    const requiredFields = allFields.filter(f => f.isRequired);
    const filledRequiredFields = requiredFields.filter(f => {
      if (Array.isArray(f.value)) {
        return f.value.length > 0;
      }
      return f.value !== null && f.value !== undefined && f.value !== '';
    });
    
    return requiredFields.length > 0 && filledRequiredFields.length === requiredFields.length;
  }

  /**
   * Submit metadata (wrapper for submitAsGuest)
   */
  async submitMetadata(): Promise<void> {
    await this.submitAsGuest();
  }
}
