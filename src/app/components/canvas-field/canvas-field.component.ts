import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CanvasFieldState, FieldStatus } from '../../models/canvas-models';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-canvas-field',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './canvas-field.component.html',
  styleUrls: ['./canvas-field.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default  // Changed from OnPush for sub-fields support
})
export class CanvasFieldComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() field!: CanvasFieldState;
  @Output() fieldChange = new EventEmitter<{ fieldId: string; value: any }>();
  @ViewChild('textareaRef') textareaRef?: ElementRef<HTMLTextAreaElement>;
  
  private destroy$ = new Subject<void>();

  FieldStatus = FieldStatus;
  filteredOptions: string[] = [];
  showAutocomplete = false;
  inputValue = '';  // Collapsed by default

  constructor(
    public i18n: I18nService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.updateInputValue();
    if (this.field.vocabulary) {
      this.filteredOptions = this.field.vocabulary.concepts.map(c => c.label);
    }
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  /**
   * Update vocabulary labels (called on language change)
   */
  private updateVocabularyLabels(): void {
    if (this.field.vocabulary) {
      const newOptions = this.field.vocabulary.concepts.map(c => c.label);
      this.filteredOptions = newOptions;
      console.log(`   ✅ Updated vocabulary for ${this.field.fieldId}:`, newOptions.length, 'concepts');
      console.log(`   First: "${newOptions[0]}"`);
      
      // Force change detection to re-render chips with new labels
      this.cdr.detectChanges();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Update input value when field value changes
    if (changes['field']) {
      const currentField = changes['field'].currentValue as CanvasFieldState;
      const previousField = changes['field'].previousValue as CanvasFieldState;
      
      // Update if value has changed
      if (!previousField || currentField.value !== previousField.value) {
        this.updateInputValue();
        console.log(`🔄 Field ${this.field.fieldId} value updated:`, this.field.value, '-> inputValue:', this.inputValue);
        
        // Resize textarea after value update
        setTimeout(() => this.autoResizeTextarea(), 0);
      }
      
      // Update vocabulary options if vocabulary exists (always check on field change)
      if (currentField.vocabulary) {
        const newOptions = currentField.vocabulary.concepts.map(c => c.label);
        const oldFirstOption = this.filteredOptions[0];
        const newFirstOption = newOptions[0];
        
        // Always update options from field (field was re-localized by canvas service)
        this.filteredOptions = newOptions;
        
        // Log if labels actually changed
        if (oldFirstOption !== newFirstOption) {
          console.log(`🌐 Field ${this.field.fieldId} vocabulary updated:`, newOptions.length, 'concepts');
          console.log(`   Changed: "${oldFirstOption}" → "${newFirstOption}"`);
          
          // Debug: Show first concept structure
          const firstConcept = currentField.vocabulary.concepts[0];
          if (firstConcept) {
            console.log(`   First concept:`, {
              label: firstConcept.label,
              label_de: firstConcept.label_de,
              label_en: firstConcept.label_en,
              uri: firstConcept.uri
            });
          }
          
          // Force change detection to re-render chips
          this.cdr.detectChanges();
        }
      }
      
      // Log label changes (for i18n debugging)
      if (previousField && currentField.label !== previousField.label) {
        console.log(`🌐 Field ${this.field.fieldId} label changed: "${previousField.label}" → "${currentField.label}"`);
      }
    }
  }

  ngAfterViewInit(): void {
    // Initial resize
    this.autoResizeTextarea();
  }

  /**
   * Get vocabulary label for a value (for i18n)
   */
  getVocabularyLabel(value: any): string {
    // If value is already a string, it might be the label or a primitive value
    if (typeof value === 'string') {
      // Try to find in vocabulary by label (current language), label_en, label_de, or uri
      if (this.field.vocabulary) {
        const concept = this.field.vocabulary.concepts.find(c => {
          // Match by current label
          if (c.label === value) return true;
          // Match by English label (in case value stores English label)
          if ((c as any).label_en === value) return true;
          // Match by German label (in case value stores German label)
          if ((c as any).label_de === value) return true;
          // Match by URI
          if (c.uri === value) return true;
          // Match by ID (if exists)
          if ((c as any).id === value) return true;
          return false;
        });
        if (concept) {
          return concept.label;  // Return localized label
        }
      }
      // Return value as-is if no vocabulary match
      return value;
    }
    
    // If value is an object, try to extract label or name
    if (typeof value === 'object' && value !== null) {
      return value.label || value.name || JSON.stringify(value);
    }
    
    return String(value);
  }

  /**
   * Update input value from field value
   */
  private updateInputValue(): void {
    const oldValue = this.inputValue;
    
    if (Array.isArray(this.field.value)) {
      // For array fields, don't show in input (show as chips instead)
      this.inputValue = '';
      console.log(`📋 ${this.field.fieldId}: Array field, chips will show values:`, this.field.value);
    } else if (this.field.value !== null && this.field.value !== undefined && this.field.value !== '') {
      // For single-value fields, show the value
      this.inputValue = String(this.field.value);
      console.log(`✏️ ${this.field.fieldId}: Set inputValue to "${this.inputValue}"`);
    } else {
      this.inputValue = '';
      console.log(`⚪ ${this.field.fieldId}: No value, clearing input`);
    }
    
    // Force change detection if value changed
    if (oldValue !== this.inputValue) {
      console.log(`🔄 ${this.field.fieldId}: Input value changed from "${oldValue}" to "${this.inputValue}"`);
    }
  }

  /**
   * Get status icon
   */
  getStatusIcon(): string {
    switch (this.field.status) {
      case FieldStatus.FILLED:
        return '✅';
      case FieldStatus.EXTRACTING:
        return '⏳';
      case FieldStatus.EMPTY:
        return this.field.isRequired ? '⚠️' : '⚪';
      case FieldStatus.ERROR:
        return '❌';
      default:
        return '⚪';
    }
  }

  /**
   * Get status class
   */
  getStatusClass(): string {
    return `status-${this.field.status}${this.field.isRequired ? ' required' : ''}`;
  }

  /**
   * Auto-resize textarea to fit content
   */
  private autoResizeTextarea(): void {
    if (!this.textareaRef) return;

    const textarea = this.textareaRef.nativeElement;
    
    // Reset height to auto to get correct scrollHeight
    textarea.style.height = 'auto';
    
    // Set height to scrollHeight (content height)
    const newHeight = Math.max(36, textarea.scrollHeight); // Min 36px (1 line)
    textarea.style.height = `${newHeight}px`;
  }

  /**
   * Handle input change
   */
  onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.inputValue = target.value;

    // Auto-resize on input
    this.autoResizeTextarea();

    // Filter autocomplete options (limit to 10)
    if (this.field.vocabulary) {
      const searchTerm = this.inputValue.toLowerCase();
      this.filteredOptions = this.field.vocabulary.concepts
        .filter(c => 
          c.label.toLowerCase().includes(searchTerm) ||
          c.altLabels?.some(alt => alt.toLowerCase().includes(searchTerm))
        )
        .slice(0, 10)  // Limit to first 10 matches
        .map(c => c.label);
      
      this.showAutocomplete = this.filteredOptions.length > 0 && this.inputValue.length > 0;
    }
  }

  /**
   * Select autocomplete option
   */
  selectOption(option: string): void {
    if (this.field.multiple) {
      // Add to array
      const currentValues = Array.isArray(this.field.value) ? this.field.value : [];
      if (!currentValues.includes(option)) {
        const newValue = [...currentValues, option];
        this.emitChange(newValue);
      }
      // Clear input after selecting
      this.inputValue = '';
    } else {
      this.inputValue = option;
      this.emitChange(option);
    }
    
    this.showAutocomplete = false;
  }

  /**
   * Handle blur event
   */
  onBlur(): void {
    console.log(`🔵 onBlur ${this.field.fieldId}: inputValue="${this.inputValue}"`);
    
    // Delay to allow click on autocomplete
    setTimeout(() => {
      this.showAutocomplete = false;
      
      // Process input value (for all fields)
      if (this.inputValue.trim()) {
        console.log(`🔵 Processing input for ${this.field.fieldId}`);
        this.processInputValue();
      }
    }, 200);
  }

  /**
   * Handle key press
   */
  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      if (this.showAutocomplete && this.filteredOptions.length > 0) {
        this.selectOption(this.filteredOptions[0]);
      } else {
        this.processInputValue();
      }
      event.preventDefault();
    }
  }

  /**
   * Process input value and emit change
   */
  private processInputValue(): void {
    let value: any = this.inputValue.trim();
    console.log(`🔄 processInputValue ${this.field.fieldId}: value="${value}", datatype="${this.field.datatype}"`);

    if (!value) {
      // Don't clear array fields on empty input
      if (!this.field.multiple) {
        this.emitChange(null);
      }
      return;
    }

    // Array fields: ADD to existing values (don't replace)
    if (this.field.multiple) {
      const newValues = value.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      const currentValues = Array.isArray(this.field.value) ? this.field.value : [];
      
      // Merge: Add new values that don't exist yet
      const mergedValues = [...currentValues];
      newValues.forEach((newVal: string) => {
        if (!mergedValues.includes(newVal)) {
          mergedValues.push(newVal);
        }
      });
      
      value = mergedValues;
      console.log(`➕ ${this.field.fieldId}: Added values. Old:`, currentValues, 'New:', newValues, 'Merged:', mergedValues);
      
      // Clear input after adding
      this.inputValue = '';
    }

    // Always emit value immediately
    // Normalization will be handled by canvas.service.ts
    console.log(`📤 Emitting value for ${this.field.fieldId}: "${value}"`);
    this.emitChange(value);
  }

  // Note: Normalization is now handled centrally by canvas.service.ts
  // to avoid double normalization and ensure consistent behavior

  /**
   * Remove chip item (for array fields)
   */
  removeChip(item: string): void {
    if (Array.isArray(this.field.value)) {
      const newValue = this.field.value.filter(v => v !== item);
      this.emitChange(newValue);
    }
  }

  /**
   * Emit field change event
   */
  private emitChange(value: any): void {
    this.fieldChange.emit({
      fieldId: this.field.fieldId,
      value: value
    });
  }

  /**
   * Check if field is content type field
   */
  isContentTypeField(): boolean {
    return this.field.fieldId === 'ccm:oeh_flex_lrt';
  }

  /**
   * Get tooltip info for field
   */
  getTooltipInfo(): string {
    let tooltip = `${this.field.label}\n\n`;
    
    if (this.field.description) {
      tooltip += `${this.field.description}\n\n`;
    }
    
    tooltip += `Typ: ${this.field.datatype}${this.field.multiple ? ' (Mehrfach)' : ''}\n`;
    
    if (this.field.isRequired) {
      tooltip += `⚠️ Pflichtfeld\n`;
    }
    
    if (this.field.vocabulary && this.field.vocabulary.concepts.length > 0) {
      tooltip += `\nVerfügbare Optionen:\n`;
      const maxShow = 10;
      const concepts = this.field.vocabulary.concepts.slice(0, maxShow);
      concepts.forEach(c => {
        tooltip += `• ${c.label}\n`;
        if (c.altLabels && c.altLabels.length > 0) {
          tooltip += `  (auch: ${c.altLabels.join(', ')})\n`;
        }
      });
      
      if (this.field.vocabulary.concepts.length > maxShow) {
        tooltip += `\n... und ${this.field.vocabulary.concepts.length - maxShow} weitere\n`;
      }
      
      tooltip += `\nHinweis: Tippen Sie, um Vorschläge zu sehen`;
    }
    
    if (this.field.validation?.pattern) {
      tooltip += `\nFormat: ${this.field.validation.pattern}`;
    }
    
    if (this.field.multiple) {
      tooltip += `\nTrennen Sie mehrere Werte mit Enter oder Komma`;
    }
    
    return tooltip;
  }

  /**
   * Handle changes from sub-fields (propagate to parent)
   */
  onSubFieldChange(event: { fieldId: string; value: any }): void {
    console.log(`📤 Sub-field change detected:`, event);
    // Propagate to parent through fieldChange event
    this.fieldChange.emit(event);
  }

  /**
   * Get tooltip text for info button
   */
  getTooltipText(): string {
    let tooltip = this.field.description || '';

    if (this.field.isRequired) {
      tooltip += '\n\n⚠️ Pflichtfeld';
    }

    if (this.field.multiple) {
      tooltip += '\nTrennen Sie mehrere Werte mit Enter oder Komma';
    }

    return tooltip;
  }

  getTooltipTextForSubField(subField: CanvasFieldState): string {
    let tooltip = subField.description || '';

    if (subField.isRequired) {
      tooltip += '\n\n⚠️ Pflichtfeld';
    }

    if (subField.multiple) {
      tooltip += '\nTrennen Sie mehrere Werte mit Enter oder Komma';
    }

    return tooltip;
  }

  /**
   * Get status icon for a given field
   */
  getStatusIconForField(field: CanvasFieldState): string {
    switch (field.status) {
      case FieldStatus.FILLED:
        return '✅';
      case FieldStatus.EMPTY:
        return '⚪';
      case FieldStatus.EXTRACTING:
        return '⏳';
      case FieldStatus.ERROR:
        return '❌';
      default:
        return '⚪';
    }
  }

  /**
   * Check if value is a nested object (not array, not null)
   */
  isNestedObject(value: any): boolean {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Determine whether a sub-field has child sub-fields (based on path prefix)
   */
  hasChildSubFields(subField: CanvasFieldState): boolean {
    if (!this.field?.subFields || !subField.path) {
      return false;
    }

    const prefix = `${subField.path}.`;
    return this.field.subFields.some(child => child !== subField && child.path?.startsWith(prefix));
  }

  /**
   * Gather child sub-fields for preview purposes
   */
  private getChildSubFields(subField: CanvasFieldState): CanvasFieldState[] {
    if (!this.field?.subFields || !subField.path) {
      return [];
    }

    const prefix = `${subField.path}.`;
    return this.field.subFields.filter(child => child.path?.startsWith(prefix));
  }

  /**
   * Determine whether a preview should be shown for a sub-field
   */
  shouldShowPreview(subField: CanvasFieldState): boolean {
    return this.isNestedObject(subField.value) || this.hasChildSubFields(subField);
  }

  /**
   * Determine whether the textarea for a sub-field should be disabled/hidden
   */
  shouldDisableSubFieldInput(subField: CanvasFieldState): boolean {
    return subField.isParent || this.isNestedObject(subField.value) || this.hasChildSubFields(subField);
  }

  /**
   * Format object value for display (instead of [object Object])
   * Converts nested objects to readable key-value pairs
   */
  formatObjectValue(obj: any): string {
    if (!obj || typeof obj !== 'object') {
      return String(obj || '');
    }

    // For nested objects, show key-value pairs
    const entries = Object.entries(obj)
      .filter(([_, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => {
        // Format key (remove prefixes, make readable)
        const formattedKey = key.replace(/^(street|postal|address)/, '');
        
        // Format value
        if (typeof value === 'object') {
          return `${formattedKey}: ${this.formatObjectValue(value)}`;
        }
        return `${formattedKey}: ${value}`;
      });

    return entries.join(', ') || 'Keine Daten';
  }

  /**
   * Create a readable preview string for structured sub-fields
   */
  getSubFieldPreview(subField: CanvasFieldState): string {
    if (this.isNestedObject(subField.value)) {
      return this.formatObjectValue(subField.value);
    }

    const childSubFields = this.getChildSubFields(subField)
      .filter(child => !this.isNestedObject(child.value));

    const childEntries = childSubFields
      .filter(child => this.isValuePresent(child.value))
      .slice(0, 4) // Prevent overly long previews
      .map(child => `${child.label}: ${child.value}`);

    if (childEntries.length > 0) {
      return childEntries.join(', ');
    }

    if (this.isValuePresent(subField.value)) {
      return String(subField.value);
    }

    return 'Noch keine Daten';
  }

  private isValuePresent(value: any): boolean {
    return value !== null && value !== undefined && value !== '';
  }

  /**
   * Get preview text for a given structured field
   */
  getStructuredPreviewForField(field: CanvasFieldState): string {
    if (!field.subFields || field.subFields.length === 0) {
      return 'Keine Daten';
    }

    const nameField = field.subFields.find(f => 
      f.path?.toLowerCase().includes('name') && f.value
    );
    if (nameField && nameField.value) {
      return String(nameField.value);
    }

    const firstFilledField = field.subFields.find(f => 
      f.value && typeof f.value === 'string' && f.value.trim() !== ''
    );
    if (firstFilledField && firstFilledField.value) {
      return String(firstFilledField.value);
    }

    return 'Noch keine Daten';
  }

  /**
   * Handle sub-field value changes
   */
  onSubFieldValueChange(subField: CanvasFieldState): void {
    console.log(`📝 Sub-field ${subField.fieldId} changed:`, subField.value);
    this.fieldChange.emit({ fieldId: subField.fieldId, value: subField.value });
  }

  /**
   * Get preview text for structured fields (fields with sub-fields)
   * Shows the first meaningful value from sub-fields
   */
  getStructuredPreview(): string {
    if (!this.field.subFields || this.field.subFields.length === 0) {
      return 'Keine Daten';
    }

    // Try to find a "name" field first (most descriptive)
    const nameField = this.field.subFields.find(f => 
      f.path?.toLowerCase().includes('name') && f.value
    );
    if (nameField && nameField.value) {
      return String(nameField.value);
    }

    // Otherwise, find the first non-empty text field
    const firstFilledField = this.field.subFields.find(f => 
      f.value && typeof f.value === 'string' && f.value.trim() !== ''
    );
    if (firstFilledField && firstFilledField.value) {
      return String(firstFilledField.value);
    }

    // Fallback: count how many fields are filled
    const filledCount = this.field.subFields.filter(f => 
      f.value !== null && f.value !== undefined && 
      (typeof f.value !== 'string' || f.value.trim() !== '')
    ).length;

    if (filledCount > 0) {
      return `${filledCount} von ${this.field.subFields.length} Felder ausgefüllt`;
    }

    return 'Noch keine Daten';
  }

  /**
   * Check if field has geo-coordinates (latitude and longitude)
   */
  hasGeoCoordinates(): boolean {
    if (!this.field.subFields || this.field.subFields.length === 0) {
      return false;
    }

    const latField = this.field.subFields.find(f => 
      f.path?.toLowerCase().includes('geo.latitude') && 
      f.value !== null && f.value !== undefined && f.value !== ''
    );
    const lonField = this.field.subFields.find(f => 
      f.path?.toLowerCase().includes('geo.longitude') && 
      f.value !== null && f.value !== undefined && f.value !== ''
    );

    return !!(latField && lonField);
  }

  /**
   * Get OpenStreetMap URL for the field's geo-coordinates
   */
  getOpenStreetMapUrl(): string | null {
    if (!this.field.subFields || this.field.subFields.length === 0) {
      return null;
    }

    // Get coordinates
    const latField = this.field.subFields.find(f => f.path?.toLowerCase().includes('geo.latitude'));
    const lonField = this.field.subFields.find(f => f.path?.toLowerCase().includes('geo.longitude'));

    if (!latField?.value || !lonField?.value) {
      return null;
    }

    const lat = Number(latField.value);
    const lon = Number(lonField.value);

    if (isNaN(lat) || isNaN(lon)) {
      return null;
    }

    // Build address query for search
    const addressParts: string[] = [];
    const streetField = this.field.subFields.find(f => f.path?.toLowerCase().includes('address.streetaddress'));
    const postalField = this.field.subFields.find(f => f.path?.toLowerCase().includes('address.postalcode'));
    const cityField = this.field.subFields.find(f => f.path?.toLowerCase().includes('address.addresslocality'));

    if (streetField?.value) addressParts.push(String(streetField.value));
    if (postalField?.value) addressParts.push(String(postalField.value));
    if (cityField?.value) addressParts.push(String(cityField.value));

    const query = addressParts.length > 0 ? addressParts.join(' ') : `${lat},${lon}`;

    // Calculate bounding box (approximately 200m x 200m)
    const latDelta = 0.0018; // ~200m in latitude
    const lonDelta = 0.0045; // ~200m in longitude (at ~50° latitude)
    
    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLon = lon - lonDelta;
    const maxLon = lon + lonDelta;

    // Build OpenStreetMap URL with search query and bounding box
    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}&zoom=18&minlon=${minLon}&minlat=${minLat}&maxlon=${maxLon}&maxlat=${maxLat}#map=19/${lat}/${lon}`;
  }

  /**
   * Open location in OpenStreetMap
   */
  openInOpenStreetMap(): void {
    const url = this.getOpenStreetMapUrl();
    if (url) {
      window.open(url, '_blank');
    }
  }

  /**
   * Check if a specific sub-field has geo-coordinates
   */
  subFieldHasGeoCoordinates(subField: CanvasFieldState): boolean {
    if (!subField.subFields || subField.subFields.length === 0) {
      return false;
    }

    const latField = subField.subFields.find(f => 
      f.path?.toLowerCase().includes('geo.latitude') && 
      f.value !== null && f.value !== undefined && f.value !== ''
    );
    const lonField = subField.subFields.find(f => 
      f.path?.toLowerCase().includes('geo.longitude') && 
      f.value !== null && f.value !== undefined && f.value !== ''
    );

    return !!(latField && lonField);
  }

  /**
   * Open sub-field location in OpenStreetMap
   */
  openSubFieldInOpenStreetMap(subField: CanvasFieldState): void {
    if (!subField.subFields || subField.subFields.length === 0) {
      return;
    }

    // Get coordinates
    const latField = subField.subFields.find(f => f.path?.toLowerCase().includes('geo.latitude'));
    const lonField = subField.subFields.find(f => f.path?.toLowerCase().includes('geo.longitude'));

    if (!latField?.value || !lonField?.value) {
      return;
    }

    const lat = Number(latField.value);
    const lon = Number(lonField.value);

    if (isNaN(lat) || isNaN(lon)) {
      return;
    }

    // Build address query for search
    const addressParts: string[] = [];
    const streetField = subField.subFields.find(f => f.path?.toLowerCase().includes('address.streetaddress'));
    const postalField = subField.subFields.find(f => f.path?.toLowerCase().includes('address.postalcode'));
    const cityField = subField.subFields.find(f => f.path?.toLowerCase().includes('address.addresslocality'));

    if (streetField?.value) addressParts.push(String(streetField.value));
    if (postalField?.value) addressParts.push(String(postalField.value));
    if (cityField?.value) addressParts.push(String(cityField.value));

    const query = addressParts.length > 0 ? addressParts.join(' ') : `${lat},${lon}`;

    // Calculate bounding box (approximately 200m x 200m)
    const latDelta = 0.0018; // ~200m in latitude
    const lonDelta = 0.0045; // ~200m in longitude (at ~50° latitude)
    
    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLon = lon - lonDelta;
    const maxLon = lon + lonDelta;

    // Build and open OpenStreetMap URL
    const url = `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}&zoom=18&minlon=${minLon}&minlat=${minLat}&maxlon=${maxLon}&maxlat=${maxLat}#map=19/${lat}/${lon}`;
    window.open(url, '_blank');
  }
}
