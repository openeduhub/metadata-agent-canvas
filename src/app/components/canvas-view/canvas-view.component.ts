import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { CanvasService } from '../../services/canvas.service';
import { SchemaLoaderService } from '../../services/schema-loader.service';
import { IntegrationModeService } from '../../services/integration-mode.service';
import { GuestSubmissionService } from '../../services/guest-submission.service';
import { CanvasState, FieldGroup, FieldStatus } from '../../models/canvas-models';
import { CanvasFieldComponent } from '../canvas-field/canvas-field.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-canvas-view',
  standalone: true,
  imports: [CommonModule, FormsModule, CanvasFieldComponent],
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
    public integrationMode: IntegrationModeService,
    private guestSubmission: GuestSubmissionService
  ) {
    this.state = this.canvasService.getCurrentState();
  }

  ngOnInit(): void {
    // Subscribe to state changes
    this.canvasService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.state = state;
        // Manually trigger change detection with OnPush strategy
        this.cdr.markForCheck();
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
      
      // Handle structured SET_PAGE_DATA (bookmarklet with URL)
      if (event.data.type === 'SET_PAGE_DATA' && event.data.text) {
        console.log('📨 Received page data via postMessage:');
        console.log('  - URL:', event.data.url);
        console.log('  - Title:', event.data.pageTitle);
        console.log('  - Mode:', event.data.mode);
        
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
      alert('Bitte geben Sie einen Text ein.');
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
      alert(`Bitte füllen Sie alle Pflichtfelder aus. (${status.filled}/${status.total} erfüllt)`);
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
      ? '✅ Metadaten werden veröffentlicht...'
      : '✅ Vorschlag wird eingereicht...');
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
      alert('Bitte füllen Sie alle Pflichtfelder aus.');
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
        this.integrationMode.sendMetadataToParent(pluginMetadata);
        
        // Show success message
        alert(`✅ Metadaten an Browser-Plugin gesendet!
        
Die Daten wurden erfolgreich an das Browser-Plugin übertragen.
Das Plugin wird nun die Veröffentlichung im Repository durchführen.

Vielen Dank! 🎉`);
        
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
      
      if (result.success) {
        // SUCCESS
        const viewInRepo = confirm(`✅ Ihr Vorschlag wurde erfolgreich eingereicht!

📋 Node-ID: ${result.nodeId}
🔍 Status: Wird geprüft
📊 Repository: WLO Staging

Ihr Beitrag wird nun von unserem Team geprüft.
Vielen Dank! 🎉

Möchten Sie den Eintrag im Repository ansehen?`);
        
        if (viewInRepo && result.nodeId) {
          const repoUrl = `${environment.repository.baseUrl}/components/render/${result.nodeId}`;
          window.open(repoUrl, '_blank');
        }
        
        // Optional: Reset after success
        if (confirm('Möchten Sie einen weiteren Vorschlag einreichen?')) {
          this.reset();
        }
      } else if (result.duplicate) {
        // DUPLICATE
        const viewInRepo = confirm(`⚠️ Diese URL existiert bereits im Repository!

${result.error}

📋 Node-ID: ${result.nodeId}

Möchten Sie den vorhandenen Eintrag im Repository ansehen?`);
        
        if (viewInRepo && result.nodeId) {
          const repoUrl = `${environment.repository.baseUrl}/components/render/${result.nodeId}`;
          window.open(repoUrl, '_blank');
        }
      } else {
        // ERROR
        alert(`❌ Fehler beim Einreichen:

${result.error || 'Unbekannter Fehler'}

Bitte versuchen Sie es später erneut oder kontaktieren Sie den Support.`);
      }
    } catch (error) {
      console.error('Submission error:', error);
      alert(`❌ Fehler beim Einreichen

Ein technischer Fehler ist aufgetreten.
Bitte versuchen Sie es später erneut.

Details: ${error instanceof Error ? error.message : 'Unbekannt'}`);
    } finally {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Download JSON file
   */
  downloadJson(): void {
    const json = this.canvasService.getMetadataJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'metadata.json';
    link.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Reset canvas
   */
  reset(): void {
    if (confirm('Möchten Sie wirklich alle Daten zurücksetzen?')) {
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
    if (this.state.selectedContentType || this.state.detectedContentType) {
      const schemaFile = this.state.selectedContentType || this.state.detectedContentType;
      return this.schemaLoader.getContentTypeLabel(schemaFile!);
    }
    return 'Nicht erkannt';
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
   */
  trackByGroupId(index: number, group: FieldGroup): string {
    return `${group.schemaName}::${group.id}`;
  }
  
  /**
   * TrackBy function for fields (performance optimization)
   */
  trackByFieldId(index: number, field: any): string {
    return field.fieldId;
  }
}
