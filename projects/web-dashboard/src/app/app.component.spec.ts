import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppComponent, TelemetryReading } from './app.component';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
  });

  it('should create the app component', () => {
    expect(component).toBeTruthy();
  });

  describe('Signal Defaults and Initial State', () => {
    it('should have initial null user', () => {
      expect(component.user()).toBeNull();
    });

    it('should initialize isLoading to false', () => {
      expect(component.isLoading()).toBe(false);
    });

    it('should report No Signal when currentReading is null', () => {
      component.currentReading.set(null);
      expect(component.tempStatus()).toBe('No Signal');
      expect(component.humidStatus()).toBe('No Signal');
      expect(component.tempBadgeClass()).toBe('badge-neutral');
      expect(component.humidBadgeClass()).toBe('badge-neutral');
    });
  });

  describe('Temperature Computed Status', () => {
    it('should classify < 18°C as Cool', () => {
      component.currentReading.set({ temperature: 15.0, humidity: 50.0, timestamp: 1000 });
      expect(component.tempStatus()).toBe('Cool');
      expect(component.tempBadgeClass()).toBe('badge-warn');
    });

    it('should classify 18°C - 26°C as Optimal', () => {
      component.currentReading.set({ temperature: 22.5, humidity: 50.0, timestamp: 1000 });
      expect(component.tempStatus()).toBe('Optimal');
      expect(component.tempBadgeClass()).toBe('badge-good');
    });

    it('should classify 27°C - 32°C as Warm', () => {
      component.currentReading.set({ temperature: 29.0, humidity: 50.0, timestamp: 1000 });
      expect(component.tempStatus()).toBe('Warm');
      expect(component.tempBadgeClass()).toBe('badge-warn');
    });

    it('should classify > 32°C as High', () => {
      component.currentReading.set({ temperature: 38.0, humidity: 50.0, timestamp: 1000 });
      expect(component.tempStatus()).toBe('High');
      expect(component.tempBadgeClass()).toBe('badge-danger');
    });
  });

  describe('Humidity Computed Status', () => {
    it('should classify < 30% as Dry', () => {
      component.currentReading.set({ temperature: 22.0, humidity: 25.0, timestamp: 1000 });
      expect(component.humidStatus()).toBe('Dry');
      expect(component.humidBadgeClass()).toBe('badge-warn');
    });

    it('should classify 30% - 60% as Comfortable', () => {
      component.currentReading.set({ temperature: 22.0, humidity: 48.0, timestamp: 1000 });
      expect(component.humidStatus()).toBe('Comfortable');
      expect(component.humidBadgeClass()).toBe('badge-good');
    });

    it('should classify 61% - 75% as Humid', () => {
      component.currentReading.set({ temperature: 22.0, humidity: 68.0, timestamp: 1000 });
      expect(component.humidStatus()).toBe('Humid');
      expect(component.humidBadgeClass()).toBe('badge-warn');
    });

    it('should classify > 75% as Very High', () => {
      component.currentReading.set({ temperature: 22.0, humidity: 85.0, timestamp: 1000 });
      expect(component.humidStatus()).toBe('Very High');
      expect(component.humidBadgeClass()).toBe('badge-danger');
    });
  });

  describe('Time Formatting', () => {
    it('should handle invalid timestamp gracefully', () => {
      expect(component.formatTime(NaN)).toBe('Invalid Time');
    });

    it('should format epoch timestamp into readable string', () => {
      const fixedTime = 1715000000000;
      const formatted = component.formatTime(fixedTime);
      expect(formatted).toBeTruthy();
      expect(formatted.length).toBeGreaterThan(5);
    });
  });
});
