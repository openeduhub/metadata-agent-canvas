import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatOptionModule } from '@angular/material/core';
import { TextFieldModule } from '@angular/cdk/text-field';
import { Subject } from 'rxjs';
import { takeUntil, distinctUntilChanged } from 'rxjs/operators';
import { EduSharingLlmService } from 'ngx-edu-sharing-b-api';
import { CanvasService } from '../../services/canvas.service';
import { SchemaLoaderService } from '../../services/schema-loader.service';
import { SchemaLocalizerService } from '../../services/schema-localizer.service';
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
  imports: [
    CommonModule, 
    FormsModule, 
    TranslateModule, 
    CanvasFieldComponent, 
    LanguageSwitcherComponent, 
    JsonLoaderComponent,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatCardModule,
    MatRadioModule,
    MatSelectModule,
    MatTooltipModule,
    MatChipsModule,
    MatMenuModule,
    MatOptionModule,
    TextFieldModule
  ],
  templateUrl: './canvas-view.component.html',
  styleUrls: ['./canvas-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CanvasViewComponent implements OnInit, OnDestroy {
  state: CanvasState;
  userText = '';
  FieldStatus = FieldStatus;
  isSubmitting = false;
  contentTypeOptions: Array<{ label: string; schemaFile: string }> = [];
  llmProvider = environment.llmProvider; // Active LLM provider
  llmModel = this.getActiveLlmModel(); // Active LLM model
  
  private destroy$ = new Subject<void>();
  private savedScrollPosition = 0;

  constructor(
    private canvasService: CanvasService,
    private schemaLoader: SchemaLoaderService,
    private schemaLocalizer: SchemaLocalizerService,
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
    this.canvasService.ensureCoreSchemaLoaded().then(() => {
      // Load content type options after schema is loaded
      this.updateContentTypeOptions();
    });
    
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
      .pipe(
        distinctUntilChanged(), // Only trigger when language actually changes
        takeUntil(this.destroy$)
      )
      .subscribe(async (language) => {
        console.log(`🔔 Language Observable fired: ${language}`);

        console.log(`🌐 Language changed to: ${language}, re-localizing fields...`);
        
        // Re-localize all fields
        await this.relocalizeFields(language);
        
        // Explicitly get updated state (important for OnPush)
        const newState = this.canvasService.getCurrentState();
        
        if (newState.coreFields.length > 0 || newState.fieldGroups.length > 0) {
          console.log(`📝 Updating component state with new field references...`);
          console.log(`   Core fields: ${newState.coreFields.length}`);
          console.log(`   Field groups: ${newState.fieldGroups.length}`);
        }
        
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
        
        // Update content type dropdown options when language changes
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
      
      // Security: Accept messages from HTTPS, localhost, or Chrome extensions
      const isSecureOrigin = event.origin.startsWith('https://') || 
                             event.origin.includes('localhost') ||
                             event.origin.includes('127.0.0.1') ||
                             event.origin.startsWith('chrome-extension://') ||
                             event.origin.startsWith('moz-extension://');
      
      if (!isSecureOrigin) {
        console.warn('⚠️ Message from untrusted origin rejected:', event.origin);
        return;
      }
      
      console.log('✅ Message origin accepted:', event.origin);
      
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
        console.log('📨 Received PLUGIN_PAGE_DATA from Browser Plugin:');
        console.log('  - URL:', event.data.url);
        console.log('  - Title:', event.data.title);
        console.log('  - Mode:', event.data.mode);
        console.log('  - Text length:', event.data.text?.length || 0);
        console.log('  - HTML length:', event.data.html?.length || 0);
        console.log('  - Text preview:', event.data.text?.substring(0, 100));
        
        // Update mode to browser-extension
        if (event.data.mode === 'browser-extension') {
          this.integrationMode.setMode('browser-extension');
          console.log('✅ Mode set to browser-extension');
        }
        
        // Set text in textarea (use text or html)
        const newText = event.data.text || event.data.html || '';
        console.log('📝 Setting userText to:', newText.length, 'characters');
        this.userText = newText;
        
        // Store URL for later use
        if (event.data.url) {
          sessionStorage.setItem('canvas_page_url', event.data.url);
        }
        
        // Store metadata if provided
        if (event.data.metadata) {
          sessionStorage.setItem('canvas_plugin_metadata', JSON.stringify(event.data.metadata));
          console.log('✅ Metadata stored in sessionStorage');
        }
        
        // Trigger change detection
        this.cdr.detectChanges();
        console.log('✅ Change detection triggered');
        
        // Send confirmation back to plugin
        if (event.source) {
          try {
            (event.source as Window).postMessage({
              type: 'PLUGIN_DATA_RECEIVED',
              success: true,
              textLength: this.userText.length
            }, event.origin);
            console.log('✅ Confirmation sent back to plugin');
          } catch (error) {
            console.error('❌ Error sending confirmation:', error);
          }
        } else {
          console.warn('⚠️ No event.source, cannot send confirmation');
        }
        
        console.log('✅ Plugin page data successfully set in canvas, userText length:', this.userText.length);
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
    // For Browser-Extension: Use structured format with repoField flags
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
      const metadata = this.canvasService.getMetadataForRepository();
      
      // BROWSER-EXTENSION MODE: Send to plugin via postMessage
      if (this.integrationMode.isBrowserExtension()) {
        console.log('📤 Sending metadata to Browser-Plugin...');
        
        // Use new structured format with repoField flags for Browser-Plugin
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
        
        // Close canvas immediately after sending
        setTimeout(() => {
          this.integrationMode.requestClose();
        }, 500);
        
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
        // DUPLICATE - Show custom dialog
        this.showDuplicateDialog(result.nodeId!, result.error || '');
      } else {
        // ERROR - Show custom dialog
        this.showErrorDialog(result.error || 'Unknown Error');
      }
    } catch (error) {
      console.error('Submission error:', error);
      this.showErrorDialog(
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
    
    // Create modal HTML with translations and QR code
    const dialogHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(2px);">
        <div style="background: white; padding: 24px; border-radius: 16px; max-width: 520px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);">
          
          <!-- Info Section -->
          <div style="background: linear-gradient(135deg, #f0f7ff 0%, #e8f4ff 100%); border-left: 4px solid #003B7C; box-shadow: 0 1px 3px rgba(0, 59, 124, 0.08); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
            <div style="margin-bottom: 16px;">
              <div style="display: flex; align-items: flex-start; gap: 12px;">
                <span style="font-size: 20px; flex-shrink: 0;">🔑</span>
                <div style="flex: 1;">
                  <div style="font-size: 11px; color: #003B7C; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">${this.i18n.instant('ALERTS.SUCCESS.NODE_ID')}</div>
                  <div style="font-size: 12px; color: #003B7C; font-family: monospace; font-weight: 500;">${nodeId}</div>
                </div>
              </div>
            </div>
            <div>
              <div style="display: flex; align-items: flex-start; gap: 12px;">
                <span style="font-size: 20px; flex-shrink: 0;">🔗</span>
                <div style="flex: 1;">
                  <div style="font-size: 11px; color: #003B7C; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Repository-Link</div>
                  <a href="${repoUrl}" target="_blank" style="font-size: 12px; color: #003B7C; text-decoration: none; word-break: break-all; font-weight: 500;">${repoUrl}</a>
                </div>
              </div>
            </div>
          </div>
          
          <!-- QR Code Section -->
          <div style="background: white; border: 2px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center;">
            <div style="font-size: 11px; color: #003B7C; font-weight: 600; text-transform: uppercase; margin-bottom: 12px;">📱 QR-Code zum Teilen</div>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(repoUrl)}" 
                 alt="QR Code" 
                 style="width: 150px; height: 150px; border-radius: 8px;"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <div style="display: none; color: #718096; font-size: 12px; padding: 20px;">QR-Code konnte nicht geladen werden</div>
            <div style="font-size: 11px; color: #718096; margin-top: 8px;">Inhalt im Repository öffnen</div>
          </div>
          
          <!-- Buttons -->
          <div style="display: flex; gap: 12px;">
            <a href="${repoUrl}" target="_blank" style="flex: 1; background-color: #003B7C !important; background-image: linear-gradient(135deg, #003B7C 0%, #004a99 100%) !important; color: #ffffff !important; padding: 14px 20px; text-decoration: none !important; border-radius: 10px; text-align: center; font-weight: 600; box-shadow: 0 2px 8px rgba(0,59,124,0.25); transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 18px;">👁️</span>
              <span>${this.i18n.instant('ALERTS.SUCCESS.VIEW_IN_REPO_BTN')}</span>
            </a>
            <button onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="flex: 1; background: #f5f7fb; color: #003B7C; border: 2px solid #d4d9e3; padding: 14px 20px; border-radius: 10px; cursor: pointer; font-weight: 600; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 18px;">✓</span>
              <span>${this.i18n.instant('HEADER.CLOSE')}</span>
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
   * Show duplicate dialog with clickable link to existing repository node
   */
  showDuplicateDialog(nodeId: string, errorMessage: string): void {
    const repoUrl = `${environment.repository.baseUrl}/components/render/${nodeId}`;
    
    // Create modal HTML with translations and QR code
    const dialogHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(2px);">
        <div style="background: white; padding: 24px; border-radius: 16px; max-width: 520px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);">
          
          <!-- Warning Box -->
          <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe8cc 100%); padding: 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #ff9800; box-shadow: 0 1px 3px rgba(255, 152, 0, 0.1);">
            <div style="font-weight: 600; color: #e65100; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
              <span>🔗</span>
              <span>${this.i18n.instant('ALERTS.DUPLICATE.TITLE')}</span>
            </div>
            <div style="font-size: 14px; color: #e65100; line-height: 1.5;">${errorMessage}</div>
          </div>
          
          <!-- Info Section -->
          <div style="background: linear-gradient(135deg, #f0f7ff 0%, #e8f4ff 100%); border-left: 4px solid #003B7C; box-shadow: 0 1px 3px rgba(0, 59, 124, 0.08); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
            <div>
              <div style="display: flex; align-items: flex-start; gap: 12px;">
                <span style="font-size: 20px; flex-shrink: 0;">🔑</span>
                <div style="flex: 1;">
                  <div style="font-size: 11px; color: #003B7C; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">${this.i18n.instant('ALERTS.DUPLICATE.NODE_ID')}</div>
                  <div style="font-size: 12px; color: #003B7C; font-family: monospace; font-weight: 500;">${nodeId}</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- QR Code Section -->
          <div style="background: white; border: 2px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; text-align: center;">
            <div style="font-size: 11px; color: #003B7C; font-weight: 600; text-transform: uppercase; margin-bottom: 12px;">📱 QR-Code zum vorhandenen Inhalt</div>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(repoUrl)}" 
                 alt="QR Code" 
                 style="width: 150px; height: 150px; border-radius: 8px;"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <div style="display: none; color: #718096; font-size: 12px; padding: 20px;">QR-Code konnte nicht geladen werden</div>
            <div style="font-size: 11px; color: #718096; margin-top: 8px;">Vorhandenen Inhalt im Repository öffnen</div>
          </div>
          
          <!-- Buttons -->
          <div style="display: flex; gap: 12px;">
            <a href="${repoUrl}" target="_blank" style="flex: 1; background-color: #003B7C !important; background-image: linear-gradient(135deg, #003B7C 0%, #004a99 100%) !important; color: #ffffff !important; padding: 14px 20px; text-decoration: none !important; border-radius: 10px; text-align: center; font-weight: 600; box-shadow: 0 2px 8px rgba(0,59,124,0.25); transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 18px;">👁️</span>
              <span>Im Repository ansehen</span>
            </a>
            <button onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="flex: 1; background: #f5f7fb; color: #003B7C; border: 2px solid #d4d9e3; padding: 14px 20px; border-radius: 10px; cursor: pointer; font-weight: 600; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 18px;">✓</span>
              <span>${this.i18n.instant('HEADER.CLOSE')}</span>
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
   * Show error dialog
   */
  showErrorDialog(errorMessage: string): void {
    // Create modal HTML with translations
    const dialogHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(2px);">
        <div style="background: white; padding: 24px; border-radius: 16px; max-width: 520px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);">
          
          <!-- Error Box -->
          <div style="background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%); padding: 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #ba1a1a; box-shadow: 0 1px 3px rgba(186, 26, 26, 0.1);">
            <div style="font-weight: 600; color: #ba1a1a; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
              <span>⚠️</span>
              <span>${this.i18n.instant('ALERTS.ERROR.SUBMISSION_ERROR')}</span>
            </div>
            <p style="margin: 0; font-weight: 500; color: #ba1a1a; font-size: 14px; line-height: 1.5;">${errorMessage}</p>
          </div>
          
          <!-- Button -->
          <div style="display: flex; gap: 12px;">
            <button onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="flex: 1; background-color: #003B7C !important; background-image: linear-gradient(135deg, #003B7C 0%, #004a99 100%) !important; color: #ffffff !important; padding: 14px 20px; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; box-shadow: 0 2px 8px rgba(0,59,124,0.25); transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 18px;">✓</span>
              <span>${this.i18n.instant('HEADER.CLOSE')}</span>
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
   * Get progress icon based on percentage (Material Design)
   */
  getProgressIcon(): string {
    const percentage = this.getProgressPercentage();
    
    if (percentage === 100) return 'celebration';  // Alles fertig!
    if (percentage >= 80) return 'sentiment_very_satisfied';  // Fast fertig
    if (percentage >= 60) return 'sentiment_satisfied';  // Guter Fortschritt
    if (percentage >= 40) return 'sentiment_neutral';  // Hälfte geschafft
    if (percentage >= 20) return 'sentiment_dissatisfied';  // Noch viel zu tun
    return 'pending';  // Gerade gestartet
  }
  
  /**
   * Get progress emoji based on percentage (Gamification) - DEPRECATED
   * @deprecated Use getProgressIcon() instead
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
   * Get current content type object for mat-select
   */
  getCurrentContentType(): { label: string; schemaFile: string } | undefined {
    const currentLabel = this.getContentTypeLabel();
    return this.contentTypeOptions.find(opt => opt.label === currentLabel);
  }

  /**
   * Select a content type from dropdown
   */
  async selectContentType(option: { label: string; schemaFile: string }): Promise<void> {
    console.log('📝 Content type selected:', option);
    console.log('Schema file to load:', option.schemaFile);
    
    // Update field value first
    this.onFieldChange({ fieldId: 'ccm:oeh_flex_lrt', value: option.label });
    
    // Trigger schema reload and re-extraction
    console.log('🔄 Triggering schema reload for:', option.schemaFile);
    await this.canvasService.changeContentTypeManually(option.schemaFile);
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
   * Only updates if options are empty or have changed to prevent flicker
   */
  private updateContentTypeOptions(): void {
    // Re-load from core.json to get fresh localized labels
    const coreSchema = this.schemaLoader.getCoreSchema();
    if (!coreSchema) {
      // Silently return - will be loaded later when schema is available
      return;
    }
    
    const contentTypeFieldDef = coreSchema.fields.find((f: any) => f.id === 'ccm:oeh_flex_lrt');
    if (!contentTypeFieldDef?.system?.vocabulary) {
      return;
    }
    
    const currentLang = this.i18n.getCurrentLanguage();
    const newOptions = contentTypeFieldDef.system.vocabulary.concepts.map((concept: any) => ({
      label: this.schemaLocalizer.localizeString(concept.label, currentLang),
      schemaFile: concept.schema_file || ''
    }));
    
    // Only update if options changed (prevent unnecessary re-renders and flicker)
    const optionsChanged = 
      this.contentTypeOptions.length === 0 || 
      this.contentTypeOptions.length !== newOptions.length ||
      this.contentTypeOptions.some((opt, i) => opt.label !== newOptions[i].label);
    
    if (optionsChanged) {
      this.contentTypeOptions = newOptions;
      console.log('✅ Updated content type options for language:', currentLang, this.contentTypeOptions);
    }
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
