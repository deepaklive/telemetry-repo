import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  getDatabase,
  Database,
  ref,
  query,
  limitToLast,
  onValue,
  Unsubscribe
} from 'firebase/database';
import { environment } from '../environments/environment';

export interface TelemetryReading {
  id?: string;
  nodeId?: string;
  temperature: number;
  humidity: number;
  timestamp: number;
  serverTime?: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-shell">
      <!-- Navbar -->
      <header class="navbar">
        <div class="brand">
          <div class="logo-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div>
            <h1>IoT Telemetry Hub</h1>
            <span class="subtitle">ESP32 + Firebase Realtime Monitor</span>
          </div>
        </div>

        <div class="nav-controls">
          <!-- Connection Status -->
          <div class="status-chip" [class.online]="isConnected()" [class.offline]="!isConnected()">
            <span class="pulse-dot"></span>
            <span>{{ isConnected() ? 'Live Stream Active' : 'Connecting...' }}</span>
          </div>

          <!-- Auth Actions -->
          <div class="auth-section">
            @if (user(); as currentUser) {
              <div class="user-profile">
                @if (currentUser.photoURL) {
                  <img [src]="currentUser.photoURL" [alt]="currentUser.displayName || 'User'" class="avatar"/>
                } @else {
                  <div class="avatar-fallback">{{ (currentUser.displayName || currentUser.email || 'U')[0].toUpperCase() }}</div>
                }
                <div class="user-meta">
                  <span class="user-name">{{ currentUser.displayName || 'Authorized User' }}</span>
                  <span class="user-email">{{ currentUser.email }}</span>
                </div>
                <button class="btn btn-secondary" (click)="handleSignOut()">Sign Out</button>
              </div>
            } @else {
              <button class="btn btn-primary" (click)="handleGoogleSignIn()" [disabled]="isLoading()">
                <svg viewBox="0 0 24 24" width="16" height="16" class="google-icon">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Sign In with Google
              </button>
            }
          </div>
        </div>
      </header>

      <!-- Main Content Container -->
      <main class="content-body">
        <!-- Configuration Warning Banner (if still template keys) -->
        @if (isPlaceholderConfig()) {
          <div class="banner warning-banner">
            <span class="banner-icon">⚠️</span>
            <div class="banner-text">
              <strong>Notice:</strong> Firebase configuration is currently using placeholder values.
              Update <code>projects/web-dashboard/src/environments/environment.ts</code> with your actual Firebase project credentials to sync live hardware telemetry.
            </div>
          </div>
        }

        @if (authError()) {
          <div class="banner error-banner">
            <span class="banner-icon">❌</span>
            <div class="banner-text">{{ authError() }}</div>
          </div>
        }

        <!-- Metric Cards Grid -->
        <section class="cards-grid">
          <!-- Temperature Card -->
          <div class="metric-card temp-card">
            <div class="card-header">
              <span class="metric-title">Temperature</span>
              <span class="badge" [ngClass]="tempBadgeClass()">{{ tempStatus() }}</span>
            </div>
            <div class="metric-value-wrap">
              <span class="metric-number">
                {{ currentReading() ? (currentReading()!.temperature | number:'1.1-1') : '--.-' }}
              </span>
              <span class="metric-unit">°C</span>
            </div>
            <div class="gauge-container">
              <div class="gauge-bar temp-bar" [style.width.%]="tempBarPercent()"></div>
            </div>
            <div class="card-footer">
              <span>Threshold: 18°C – 28°C</span>
              <span>Target: Ambient</span>
            </div>
          </div>

          <!-- Humidity Card -->
          <div class="metric-card humid-card">
            <div class="card-header">
              <span class="metric-title">Relative Humidity</span>
              <span class="badge" [ngClass]="humidBadgeClass()">{{ humidStatus() }}</span>
            </div>
            <div class="metric-value-wrap">
              <span class="metric-number">
                {{ currentReading() ? (currentReading()!.humidity | number:'1.1-1') : '--.-' }}
              </span>
              <span class="metric-unit">%</span>
            </div>
            <div class="gauge-container">
              <div class="gauge-bar humid-bar" [style.width.%]="humidBarPercent()"></div>
            </div>
            <div class="card-footer">
              <span>Comfort Range: 40% – 60%</span>
              <span>Sensor: DHT11</span>
            </div>
          </div>

          <!-- Node Telemetry Status Card -->
          <div class="metric-card info-card">
            <div class="card-header">
              <span class="metric-title">Node Station</span>
              <span class="badge badge-info">node_01</span>
            </div>
            <div class="info-list">
              <div class="info-row">
                <span class="label">Last Received</span>
                <span class="value">{{ formattedTimestamp() }}</span>
              </div>
              <div class="info-row">
                <span class="label">Reporting Interval</span>
                <span class="value">15 minutes</span>
              </div>
              <div class="info-row">
                <span class="label">Hardware Pinout</span>
                <span class="value">DHT11: D27 | LCD: D19/23</span>
              </div>
              <div class="info-row">
                <span class="label">Total Records Cached</span>
                <span class="value">{{ readingHistory().length }} readings</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Historical Readings Table -->
        <section class="history-section">
          <div class="history-header">
            <h2>Recent Telemetry Stream</h2>
            <span class="badge badge-neutral">Latest {{ readingHistory().length }} entries</span>
          </div>

          <div class="table-container">
            <table class="telemetry-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Node ID</th>
                  <th>Temperature (°C)</th>
                  <th>Humidity (%)</th>
                  <th>Condition</th>
                </tr>
              </thead>
              <tbody>
                @for (item of readingHistory(); track item.timestamp) {
                  <tr>
                    <td>{{ formatTime(item.timestamp) }}</td>
                    <td><code>{{ item.nodeId || 'node_01' }}</code></td>
                    <td class="font-mono text-temp">{{ item.temperature | number:'1.1-1' }} °C</td>
                    <td class="font-mono text-humid">{{ item.humidity | number:'1.1-1' }} %</td>
                    <td>
                      <span class="mini-status" [class.status-good]="item.temperature >= 18 && item.temperature <= 28">
                        {{ item.temperature < 18 ? 'Cool' : (item.temperature > 28 ? 'Warm' : 'Normal') }}
                      </span>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="empty-state">
                      <div class="empty-wrap">
                        <span class="empty-icon">📡</span>
                        <p>No telemetry readings received yet.</p>
                        <small>Verify your ESP32 is powered and connected to WiFi.</small>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background-color: #0d1117;
      color: #c9d1d9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    .dashboard-shell {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 20px;
    }

    /* Navbar */
    .navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      margin-bottom: 24px;
      gap: 16px;
      flex-wrap: wrap;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .logo-icon {
      background: linear-gradient(135deg, #1f6feb, #388bfd);
      color: #ffffff;
      padding: 10px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .brand h1 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: #f0f6fc;
      letter-spacing: -0.01em;
    }

    .brand .subtitle {
      font-size: 0.8rem;
      color: #8b949e;
    }

    .nav-controls {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    /* Status Chip */
    .status-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 500;
      background: #21262d;
      border: 1px solid #30363d;
      color: #8b949e;
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #8b949e;
    }

    .status-chip.online {
      color: #3fb950;
      border-color: rgba(63, 185, 80, 0.3);
      background: rgba(63, 185, 80, 0.1);
    }

    .status-chip.online .pulse-dot {
      background-color: #3fb950;
      box-shadow: 0 0 8px #3fb950;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
    }

    .btn-primary {
      background: #ffffff;
      color: #1f2328;
    }

    .btn-primary:hover {
      background: #e1e4e8;
    }

    .btn-secondary {
      background: #21262d;
      color: #c9d1d9;
      border: 1px solid #30363d;
    }

    .btn-secondary:hover {
      background: #30363d;
      color: #f0f6fc;
    }

    .user-profile {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 2px solid #388bfd;
    }

    .avatar-fallback {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #1f6feb;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
    }

    .user-meta {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }

    .user-name {
      font-size: 0.85rem;
      font-weight: 600;
      color: #f0f6fc;
    }

    .user-email {
      font-size: 0.75rem;
      color: #8b949e;
    }

    /* Banners */
    .banner {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 18px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-size: 0.9rem;
      line-height: 1.4;
    }

    .warning-banner {
      background: rgba(210, 153, 34, 0.15);
      border: 1px solid rgba(210, 153, 34, 0.4);
      color: #e3b341;
    }

    .error-banner {
      background: rgba(248, 81, 73, 0.15);
      border: 1px solid rgba(248, 81, 73, 0.4);
      color: #f85149;
    }

    /* Metric Cards */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 20px;
      margin-bottom: 28px;
    }

    .metric-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }

    .metric-card:hover {
      border-color: #58a6ff;
      transform: translateY(-2px);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .metric-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge-good {
      background: rgba(63, 185, 80, 0.2);
      color: #3fb950;
      border: 1px solid rgba(63, 185, 80, 0.4);
    }

    .badge-warn {
      background: rgba(210, 153, 34, 0.2);
      color: #e3b341;
      border: 1px solid rgba(210, 153, 34, 0.4);
    }

    .badge-danger {
      background: rgba(248, 81, 73, 0.2);
      color: #f85149;
      border: 1px solid rgba(248, 81, 73, 0.4);
    }

    .badge-info {
      background: rgba(88, 166, 255, 0.2);
      color: #58a6ff;
      border: 1px solid rgba(88, 166, 255, 0.4);
    }

    .badge-neutral {
      background: #21262d;
      color: #8b949e;
      border: 1px solid #30363d;
    }

    .metric-value-wrap {
      display: flex;
      align-items: baseline;
      gap: 6px;
      margin-bottom: 18px;
    }

    .metric-number {
      font-size: 3.25rem;
      font-weight: 800;
      color: #f0f6fc;
      letter-spacing: -0.03em;
      line-height: 1;
    }

    .metric-unit {
      font-size: 1.5rem;
      font-weight: 500;
      color: #8b949e;
    }

    /* Gauge */
    .gauge-container {
      height: 8px;
      background: #21262d;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 16px;
    }

    .gauge-bar {
      height: 100%;
      border-radius: 4px;
      transition: width 0.5s ease-out;
    }

    .temp-bar {
      background: linear-gradient(90deg, #388bfd, #d29922, #f85149);
    }

    .humid-bar {
      background: linear-gradient(90deg, #388bfd, #2ea043);
    }

    .card-footer {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: #8b949e;
      border-top: 1px solid #21262d;
      padding-top: 12px;
    }

    /* Station Info Rows */
    .info-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 8px 0;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      border-bottom: 1px dashed #21262d;
      padding-bottom: 8px;
    }

    .info-row .label {
      color: #8b949e;
    }

    .info-row .value {
      color: #f0f6fc;
      font-weight: 500;
    }

    /* History Table */
    .history-section {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 24px;
    }

    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }

    .history-header h2 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: #f0f6fc;
    }

    .table-container {
      overflow-x: auto;
    }

    .telemetry-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;
    }

    .telemetry-table th {
      color: #8b949e;
      font-weight: 600;
      padding: 12px 14px;
      border-bottom: 1px solid #30363d;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }

    .telemetry-table td {
      padding: 12px 14px;
      border-bottom: 1px solid #21262d;
      color: #c9d1d9;
    }

    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .text-temp {
      color: #ff7b72;
      font-weight: 600;
    }

    .text-humid {
      color: #79c0ff;
      font-weight: 600;
    }

    .mini-status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.75rem;
      background: rgba(210, 153, 34, 0.15);
      color: #e3b341;
    }

    .mini-status.status-good {
      background: rgba(63, 185, 80, 0.15);
      color: #3fb950;
    }

    .empty-state {
      text-align: center;
      padding: 40px !important;
    }

    .empty-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .empty-icon {
      font-size: 2rem;
    }

    .empty-wrap p {
      margin: 0;
      color: #f0f6fc;
      font-weight: 600;
    }

    .empty-wrap small {
      color: #8b949e;
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  // Firebase references
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private db: Database | null = null;
  private unsubscribeDb: Unsubscribe | null = null;

  // Reactive Signals
  user = signal<User | null>(null);
  isLoading = signal<boolean>(false);
  authError = signal<string | null>(null);
  isConnected = signal<boolean>(false);
  currentReading = signal<TelemetryReading | null>(null);
  readingHistory = signal<TelemetryReading[]>([]);

  // Computed properties
  isPlaceholderConfig = computed(() => {
    return environment.firebase.apiKey.includes('YOUR_API_KEY');
  });

  tempStatus = computed(() => {
    const reading = this.currentReading();
    if (!reading) return 'No Signal';
    const t = reading.temperature;
    if (t < 18) return 'Cool';
    if (t <= 26) return 'Optimal';
    if (t <= 32) return 'Warm';
    return 'High';
  });

  tempBadgeClass = computed(() => {
    const s = this.tempStatus();
    switch (s) {
      case 'Optimal': return 'badge-good';
      case 'Cool':
      case 'Warm': return 'badge-warn';
      case 'High': return 'badge-danger';
      default: return 'badge-neutral';
    }
  });

  tempBarPercent = computed(() => {
    const reading = this.currentReading();
    if (!reading) return 0;
    // Map -10°C to 50°C into 0..100%
    const pct = ((reading.temperature - (-10)) / (50 - (-10))) * 100;
    return Math.max(0, Math.min(100, pct));
  });

  humidStatus = computed(() => {
    const reading = this.currentReading();
    if (!reading) return 'No Signal';
    const h = reading.humidity;
    if (h < 30) return 'Dry';
    if (h <= 60) return 'Comfortable';
    if (h <= 75) return 'Humid';
    return 'Very High';
  });

  humidBadgeClass = computed(() => {
    const s = this.humidStatus();
    switch (s) {
      case 'Comfortable': return 'badge-good';
      case 'Dry':
      case 'Humid': return 'badge-warn';
      default: return 'badge-danger';
    }
  });

  humidBarPercent = computed(() => {
    const reading = this.currentReading();
    if (!reading) return 0;
    return Math.max(0, Math.min(100, reading.humidity));
  });

  formattedTimestamp = computed(() => {
    const reading = this.currentReading();
    if (!reading || !reading.timestamp) return 'Awaiting signal';
    return this.formatTime(reading.timestamp);
  });

  ngOnInit(): void {
    this.initializeFirebase();
  }

  ngOnDestroy(): void {
    if (this.unsubscribeDb) {
      this.unsubscribeDb();
    }
  }

  private initializeFirebase(): void {
    try {
      this.app = initializeApp(environment.firebase);
      this.auth = getAuth(this.app);
      this.db = getDatabase(this.app);

      // Listen to auth state changes
      onAuthStateChanged(this.auth, (user) => {
        this.user.set(user);
        if (user) {
          this.listenToTelemetry();
        } else {
          // In some setups, public read rules allow telemetry without auth
          // We attach the listener directly as well
          this.listenToTelemetry();
        }
      });
    } catch (err: any) {
      console.warn('Firebase initialization notice:', err.message);
      // Fallback with mock data for demonstration if Firebase not yet linked
      this.loadDemoFallback();
    }
  }

  async handleGoogleSignIn(): Promise<void> {
    if (!this.auth) {
      this.authError.set('Firebase Auth is not configured. Please supply API keys in environment.ts');
      return;
    }
    this.isLoading.set(true);
    this.authError.set(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(this.auth, provider);
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      this.authError.set(err.message || 'Google Sign-In failed');
    } finally {
      this.isLoading.set(false);
    }
  }

  async handleSignOut(): Promise<void> {
    if (!this.auth) return;
    try {
      await signOut(this.auth);
      this.user.set(null);
    } catch (err: any) {
      console.error('Sign-out error:', err);
    }
  }

  private listenToTelemetry(): void {
    if (!this.db || this.unsubscribeDb) return;

    try {
      const readingsRef = ref(this.db, environment.telemetryNodePath);
      const recentQuery = query(readingsRef, limitToLast(20));

      this.unsubscribeDb = onValue(
        recentQuery,
        (snapshot) => {
          this.isConnected.set(true);
          if (!snapshot.exists()) {
            return;
          }

          const rawData = snapshot.val();
          const readings: TelemetryReading[] = [];

          if (typeof rawData === 'object' && rawData !== null) {
            // Handle multiple push items or single reading map
            Object.keys(rawData).forEach((key) => {
              const item = rawData[key];
              if (item && typeof item.temperature === 'number' && typeof item.humidity === 'number') {
                readings.push({
                  id: key,
                  nodeId: item.nodeId || 'node_01',
                  temperature: item.temperature,
                  humidity: item.humidity,
                  timestamp: item.timestamp || item.serverTime || Date.now()
                });
              }
            });
          }

          if (readings.length > 0) {
            // Sort newest first
            readings.sort((a, b) => b.timestamp - a.timestamp);
            this.currentReading.set(readings[0]);
            this.readingHistory.set(readings);
          }
        },
        (error) => {
          console.warn('Realtime database read listener notice:', error.message);
          this.isConnected.set(false);
        }
      );
    } catch (err: any) {
      console.error('Telemetry subscription error:', err);
    }
  }

  private loadDemoFallback(): void {
    // Provides illustrative readings so the UI displays nicely before live credentials are bound
    const now = Date.now();
    const demoItems: TelemetryReading[] = [
      { nodeId: 'node_01', temperature: 24.6, humidity: 52.3, timestamp: now },
      { nodeId: 'node_01', temperature: 24.4, humidity: 53.0, timestamp: now - 900000 },
      { nodeId: 'node_01', temperature: 24.1, humidity: 54.1, timestamp: now - 1800000 }
    ];
    this.currentReading.set(demoItems[0]);
    this.readingHistory.set(demoItems);
    this.isConnected.set(true);
  }

  formatTime(ts: number): string {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? 'Invalid Time' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (' + d.toLocaleDateString() + ')';
  }
}
