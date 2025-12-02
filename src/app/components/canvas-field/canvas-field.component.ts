import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatOptionModule } from '@angular/material/core';
import { TextFieldModule } from '@angular/cdk/text-field';
import { Subject } from 'rxjs';
import { CanvasFieldState, FieldStatus } from '../../models/canvas-models';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-canvas-field',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    TranslateModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatAutocompleteModule,
    MatOptionModule,
    TextFieldModule
  ],
  templateUrl: './canvas-field.component.html',
  styleUrls: ['./canvas-field.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default  // Changed from OnPush for sub-fields support
})
export class CanvasFieldComponent implements OnInit, OnChanges, OnDestroy {
  @Input() field!: CanvasFieldState;
  @Input() readonly = false;  // Viewer mode: disable editing
  @Input() showActions = true;  // Show action icons (dropdown, status, geo button)
  @Output() fieldChange = new EventEmitter<{ fieldId: string; value: any }>();
  @ViewChild('mainAutocomplete') autocompleteTrigger?: MatAutocompleteTrigger;
  
  private destroy$ = new Subject<void>();

  FieldStatus = FieldStatus;
  filteredOptions: string[] = [];
  showAutocomplete = false;
  inputValue = '';  // Collapsed by default

  private supportIdCache = new Map<string, string>();
  
  // Cached text to avoid recalculation on every change detection
  supportText: string = '';
  errorText: string = '';
  hasError: boolean = false;

  constructor(
    public i18n: I18nService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.updateInputValue();
    if (this.field.vocabulary) {
      this.filteredOptions = this.field.vocabulary.concepts.map(c => c.label);
    }
    // Initialize cached texts
    this.updateCachedTexts();
  }

  private updateCachedTexts(): void {
    this.supportText = this.calculateSupportingText();
    this.hasError = this.calculateErrorState();
    this.errorText = this.hasError ? this.calculateErrorMessage() : '';
  }

  /**
   * Supporting text beneath field
   */
  /**
   * Get display label for field (includes parent label for subfields)
   */
  getFieldLabel(field: CanvasFieldState = this.field): string {
    if (!field.parentFieldId) {
      return field.label;
    }

    // For subfields, use the stored parent label
    if (field.parentFieldLabel) {
      return `${field.parentFieldLabel} (${field.label})`;
    }

    return field.label;
  }

  private calculateSupportingText(): string {
    const field = this.field;

    // Only show description if available
    if (field.description) {
      return field.description;
    }

    return '';
  }

  getSupportId(fieldId: string): string {
    if (!this.supportIdCache.has(fieldId)) {
      this.supportIdCache.set(fieldId, `${fieldId.replace(/[^a-zA-Z0-9_-]/g, '-')}-support`);
    }
    return this.supportIdCache.get(fieldId)!;
  }

  private calculateErrorState(): boolean {
    return this.field.status === FieldStatus.ERROR || (this.field.isRequired && !this.isValuePresent(this.field.value));
  }

  private calculateErrorMessage(): string {
    if (this.field.status === FieldStatus.ERROR && this.field.extractionError) {
      return this.field.extractionError;
    }
    if (this.field.isRequired && !this.isValuePresent(this.field.value)) {
      return this.i18n.instant('VALIDATION.REQUIRED_FIELD');
    }
    if (this.field.validation?.pattern) {
      return this.i18n.instant('VALIDATION.INVALID_FORMAT');
    }
    return '';
  }

  // Keep public methods for template backward compatibility
  hasErrorState(): boolean {
    return this.hasError;
  }

  getErrorMessage(): string {
    return this.errorText;
  }

  getSupportingText(): string {
    return this.supportText;
  }

  getStatusTooltip(status: FieldStatus): string {
    switch (status) {
      case FieldStatus.FILLED:
        return this.i18n.instant('FIELD.FILLED');
      case FieldStatus.EXTRACTING:
        return this.i18n.instant('FIELD.EXTRACTING');
      case FieldStatus.ERROR:
        return this.i18n.instant('FIELD.ERROR');
      case FieldStatus.EMPTY:
      default:
        return this.i18n.instant('FIELD.EMPTY');
    }
  }

  onFocus(trigger: MatAutocompleteTrigger): void {
    if (this.field.vocabulary && !this.showAutocomplete) {
      this.openAutocomplete(trigger);
    }
  }

  openAutocomplete(trigger: MatAutocompleteTrigger): void {
    if (!this.field.vocabulary) {
      return;
    }

    if (!this.inputValue) {
      this.filteredOptions = this.field.vocabulary.concepts.map(c => c.label).slice(0, 10);
    }

    trigger.openPanel();
    this.showAutocomplete = true;
  }

  toggleAutocomplete(trigger: MatAutocompleteTrigger): void {
    if (!this.field.vocabulary) {
      return;
    }

    if (trigger.panelOpen) {
      trigger.closePanel();
      this.showAutocomplete = false;
    } else {
      this.openAutocomplete(trigger);
    }
  }
  
  /**
   * Toggle autocomplete from button (uses ViewChild)
   */
  toggleAutocompleteFromButton(): void {
    if (!this.field.vocabulary || !this.autocompleteTrigger) {
      return;
    }

    if (this.autocompleteTrigger.panelOpen) {
      this.autocompleteTrigger.closePanel();
      this.showAutocomplete = false;
    } else {
      this.openAutocomplete(this.autocompleteTrigger);
    }
  }

  onDropdownMouseDown(event: MouseEvent): void {
    // Prevent textarea blur when pressing the suffix button
    event.preventDefault();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    // Update input value when field value changes
    if (changes['field']) {
      const currentField = changes['field'].currentValue as CanvasFieldState;
      const previousField = changes['field'].previousValue as CanvasFieldState;
      
      // Update cached support/error texts
      this.updateCachedTexts();
      
      // Update if value has changed
      if (!previousField || currentField.value !== previousField.value) {
        this.updateInputValue();
      }
      
      // Update vocabulary options if vocabulary exists (always check on field change)
      if (currentField.vocabulary) {
        const newOptions = currentField.vocabulary.concepts.map(c => c.label);
        const oldFirstOption = this.filteredOptions[0];
        const newFirstOption = newOptions[0];
        
        // Always update options from field (field was re-localized by canvas service)
        this.filteredOptions = newOptions;
        
        // Force change detection if labels changed
        if (oldFirstOption !== newFirstOption) {
          this.cdr.detectChanges();
        }
      }
    }
  }

  /**
   * Get vocabulary label for a value (for i18n)
   */
  getVocabularyLabel(value: any): string {
    // If value is a primitive (string, number), try to find in vocabulary
    if (typeof value === 'string' || typeof value === 'number') {
      // Try to find in vocabulary by value, label, uri, or id
      if (this.field.vocabulary) {
        const concept = this.field.vocabulary.concepts.find(c => {
          // Match by value field (MOST IMPORTANT for new schema structure)
          if ((c as any).value === value) return true;
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
      return String(value);
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
    if (Array.isArray(this.field.value)) {
      // For array fields, don't show in input (show as chips instead)
      this.inputValue = '';
    } else if (this.field.value !== null && this.field.value !== undefined && this.field.value !== '') {
      let value = String(this.field.value);
      
      // Fix datetime-local format: if date-only, append T00:00
      if (this.field.datatype === 'datetime' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        value = value + 'T00:00';
      }
      
      this.inputValue = value;
    } else {
      this.inputValue = '';
    }
  }
  
  /**
   * Handle boolean dropdown change
   */
  onBooleanChange(value: string | null): void {
    if (value === null) {
      this.emitChange(null);
    } else {
      const boolValue = value === 'true';
      this.emitChange(boolValue);
    }
  }
  

  /**
   * Get status icon (legacy - kept for compatibility)
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
   * Get Material Icon name for status
   */
  getStatusIconName(): string {
    switch (this.field.status) {
      case FieldStatus.FILLED:
        return 'check_circle';
      case FieldStatus.EXTRACTING:
        return 'hourglass_empty';
      case FieldStatus.EMPTY:
        return this.field.isRequired ? 'warning' : 'radio_button_unchecked';
      case FieldStatus.ERROR:
        return 'error';
      default:
        return 'radio_button_unchecked';
    }
  }

  /**
   * Get Material Icon name for a given field
   */
  getStatusIconNameForField(field: CanvasFieldState): string {
    switch (field.status) {
      case FieldStatus.FILLED:
        return 'check_circle';
      case FieldStatus.EMPTY:
        return field.isRequired ? 'warning' : 'radio_button_unchecked';
      case FieldStatus.EXTRACTING:
        return 'hourglass_empty';
      case FieldStatus.ERROR:
        return 'error';
      default:
        return 'radio_button_unchecked';
    }
  }

  /**
   * Get status class
   */
  getStatusClass(): string {
    return `status-${this.field.status}${this.field.isRequired ? ' required' : ''}`;
  }

  /**
   * Handle input change (CDK cdkTextareaAutosize handles resize)
   */
  onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.inputValue = target.value;

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
        this.field.value = newValue;
        this.emitChange(newValue);
      }
      
      // Clear input AFTER mat-autocomplete has set its value (next tick)
      // mat-autocomplete writes the selected value to input AFTER this handler completes
      setTimeout(() => {
        this.inputValue = '';
        this.cdr.markForCheck();
      }, 0);
      
      // Keep autocomplete open for multiple selection
      setTimeout(() => {
        if (this.autocompleteTrigger) {
          // Show all options again
          if (this.field.vocabulary) {
            this.filteredOptions = this.field.vocabulary.concepts.map(c => c.label).slice(0, 10);
          }
          this.autocompleteTrigger.openPanel();
        }
      }, 50);
    } else {
      this.inputValue = option;
      this.emitChange(option);
      this.showAutocomplete = false;
    }
  }

  /**
   * Handle blur event
   */
  onBlur(): void {
    // Delay to allow click on autocomplete
    setTimeout(() => {
      // Don't close if it's a multiple field and panel is about to reopen
      if (!this.field.multiple || !this.autocompleteTrigger?.panelOpen) {
        this.showAutocomplete = false;
      }
      
      // Process input value (for non-multiple fields or if input is not empty)
      if (this.inputValue.trim() && !this.field.multiple) {
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
      this.inputValue = '';
      this.cdr.markForCheck();  // Trigger change detection to update textarea
    }

    this.emitChange(value);
  }

  // Note: Normalization is now handled centrally by canvas.service.ts
  // to avoid double normalization and ensure consistent behavior

  /**
   * Remove chip item (for array fields)
   */
  removeChip(item: string, targetField: CanvasFieldState = this.field): void {
    if (!Array.isArray(targetField.value)) {
      return;
    }

    const newValue = targetField.value.filter(v => v !== item);

    if (targetField === this.field) {
      this.emitChange(newValue);
    } else {
      this.fieldChange.emit({ fieldId: targetField.fieldId, value: newValue });
    }
  }

  /**
   * Emit field change event
   */
  emitChange(value: any): void {
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
   * Handle changes from sub-fields (propagate to parent)
   */
  onSubFieldChange(event: { fieldId: string; value: any }): void {
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
