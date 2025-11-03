import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface LoadedJsonData {
  metadata: any;
  detectedSchema?: string;
  fileName: string;
}

@Component({
  selector: 'app-json-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './json-loader.component.html',
  styleUrls: ['./json-loader.component.scss']
})
export class JsonLoaderComponent {
  @Output() jsonLoaded = new EventEmitter<LoadedJsonData>();
  
  isLoading = false;
  showError = false;
  errorMessage = '';

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    
    // Validate file type
    if (!file.name.endsWith('.json')) {
      this.showErrorMessage('Bitte wählen Sie eine JSON-Datei');
      return;
    }

    this.isLoading = true;
    this.showError = false;

    const reader = new FileReader();
    
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const content = e.target?.result as string;
        const jsonData = JSON.parse(content);
        
        // Detect schema from JSON
        const detectedSchema = this.detectSchema(jsonData);
        
        this.jsonLoaded.emit({
          metadata: jsonData,
          detectedSchema,
          fileName: file.name
        });
        
        this.isLoading = false;
      } catch (error) {
        this.showErrorMessage('Ungültige JSON-Datei: ' + (error as Error).message);
        this.isLoading = false;
      }
    };

    reader.onerror = () => {
      this.showErrorMessage('Fehler beim Laden der Datei');
      this.isLoading = false;
    };

    reader.readAsText(file);
    
    // Reset input
    input.value = '';
  }

  private detectSchema(jsonData: any): string | undefined {
    // Try to detect schema from various indicators
    
    // 1. Check for explicit metadataset property
    if (jsonData.metadataset) {
      return jsonData.metadataset;
    }
    
    // 2. Check for ccm:metadataset
    if (jsonData['ccm:metadataset']) {
      return jsonData['ccm:metadataset'];
    }
    
    // 3. Heuristic: Check for event-specific fields
    if (jsonData['ccm:oeh_event_date_from'] || 
        jsonData['ccm:oeh_event_date_to'] ||
        jsonData['ccm:oeh_event_location']) {
      return 'mds_oeh_event';
    }
    
    // 4. Check for tool-specific fields
    if (jsonData['ccm:oeh_tool_category'] || 
        jsonData['ccm:oeh_tool_features']) {
      return 'mds_oeh_tool';
    }
    
    // 5. Default to standard OEH
    return 'mds_oeh';
  }

  private showErrorMessage(message: string): void {
    this.errorMessage = message;
    this.showError = true;
    setTimeout(() => {
      this.showError = false;
    }, 5000);
  }

  triggerFileInput(): void {
    const fileInput = document.getElementById('json-file-input') as HTMLInputElement;
    fileInput?.click();
  }
}
