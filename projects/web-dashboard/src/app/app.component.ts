import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { FirebaseApp, initializeApp } from 'firebase/app';
import {
  Database,
  Unsubscribe,
  getDatabase,
  limitToLast,
  onValue,
  query,
  ref
} from 'firebase/database';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../environments/environment';

export interface TelemetryReading {
  id?: string;
  nodeId?: string;
  temperature: number;
  humidity: number;
  timestamp: number;
  serverTime?: number;
}

interface ChartPoint {
  id: string;
  x: number;
  y: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatProgressBarModule,
    MatTableModule,
    MatTooltipModule
  ],
  template: `
    <div class="app-layout">
      <aside class="sidebar">
        <a class="brand" href="#" aria-label="Telemetry home">
          <span class="brand-mark"><mat-icon>graphic_eq</mat-icon></span>
          <span class="brand-copy">
            <strong>Fieldnote</strong>
            <small>TELEMETRY CLOUD</small>
          </span>
        </a>

        <div class="workspace-label">WORKSPACE</div>
        <nav class="side-nav" aria-label="Main navigation">
          <a class="nav-link active" href="#overview" aria-current="page">
            <mat-icon>space_dashboard</mat-icon><span>Overview</span>
          </a>
          <a class="nav-link" href="#readings">
            <mat-icon>query_stats</mat-icon><span>Readings</span>
            <span class="nav-count">{{ readingHistory().length }}</span>
          </a>
        </nav>

        <div class="sidebar-bottom">
          <div class="sidebar-node">
            <span class="node-icon"><mat-icon>sensors</mat-icon></span>
            <span class="node-copy">
              <strong>ESP32 · node_01</strong>
              <small><span class="tiny-dot" [class.online]="isConnected()"></span>{{ isConnected() ? 'Connected' : 'Not connected' }}</small>
            </span>
            <mat-icon class="more-icon">more_horiz</mat-icon>
          </div>
          <div class="sidebar-footer">
            <span class="avatar-small">F</span>
            <span>Fieldnote workspace</span>
            <mat-icon>unfold_more</mat-icon>
          </div>
        </div>
      </aside>

      <main class="main-content" id="overview">
        <header class="topbar">
          <div class="breadcrumbs"><span>Workspace</span><mat-icon>chevron_right</mat-icon><strong>Overview</strong></div>
          <div class="topbar-actions">
            <div class="connection-pill" [class.connected]="isConnected()">
              <span class="connection-dot"></span>
              {{ isConnected() ? 'Live connection' : 'Offline' }}
            </div>
            @if (user(); as currentUser) {
              <div class="user-actions">
                @if (currentUser.photoURL) {
                  <img class="user-avatar" [src]="currentUser.photoURL" [alt]="currentUser.displayName || 'Signed-in user'">
                } @else {
                  <span class="user-avatar avatar-fallback">{{ (currentUser.displayName || currentUser.email || 'U')[0].toUpperCase() }}</span>
                }
                <span class="user-name">{{ currentUser.displayName || currentUser.email }}</span>
                <button mat-button class="sign-in-button" (click)="handleSignOut()">Sign out</button>
              </div>
            } @else {
              <button mat-flat-button color="primary" class="sign-in-button" (click)="handleGoogleSignIn()" [disabled]="isLoading() || isPlaceholderConfig()">
                <mat-icon>account_circle</mat-icon>
                {{ isLoading() ? 'Signing in…' : 'Sign in' }}
              </button>
            }
          </div>
        </header>

        <div class="page-content">
          @if (isPlaceholderConfig()) {
            <div class="notice-banner">
              <mat-icon>info</mat-icon>
              <div>
                <strong>Connect your Firebase project</strong>
                <span>Add your Firebase web app settings to <code>environment.ts</code> to enable sign-in and live readings.</span>
              </div>
            </div>
          }
          @if (authError()) {
            <div class="notice-banner error-banner" role="alert">
              <mat-icon>error_outline</mat-icon>
              <div><strong>Connection issue</strong><span>{{ authError() }}</span></div>
              <button mat-icon-button aria-label="Dismiss error" (click)="authError.set(null)"><mat-icon>close</mat-icon></button>
            </div>
          }

          <section class="page-heading">
            <div>
              <div class="eyebrow"><span class="eyebrow-mark"></span> ENVIRONMENTAL MONITORING</div>
              <h1>Good {{ greeting() }}<span class="heading-period">.</span></h1>
              <p>Your sensor station at a glance. Here’s what’s happening right now.</p>
            </div>
            <div class="heading-date">
              <mat-icon>calendar_today</mat-icon>
              <span>{{ todayLabel() }}</span>
            </div>
          </section>

          <section class="metric-grid" aria-label="Current sensor metrics">
            <mat-card class="metric-card temperature-card">
              <mat-card-content>
                <div class="metric-topline">
                  <span class="metric-icon temperature-icon"><mat-icon>device_thermostat</mat-icon></span>
                  <mat-chip class="metric-chip" [class.chip-good]="tempStatus() === 'Optimal'" [class.chip-warn]="tempStatus() === 'Cool' || tempStatus() === 'Warm'" [class.chip-alert]="tempStatus() === 'High'">
                    <span class="chip-dot"></span>{{ tempStatus() }}
                  </mat-chip>
                </div>
                <div class="metric-label">TEMPERATURE</div>
                <div class="metric-reading">{{ currentReading() ? (currentReading()!.temperature | number:'1.1-1') : '—' }}<span>°C</span></div>
                <div class="metric-foot">
                  <span>Comfort range</span><strong>18° — 28°C</strong>
                </div>
                <mat-progress-bar mode="determinate" [value]="tempBarPercent()" aria-label="Temperature range"></mat-progress-bar>
              </mat-card-content>
            </mat-card>

            <mat-card class="metric-card humidity-card">
              <mat-card-content>
                <div class="metric-topline">
                  <span class="metric-icon humidity-icon"><mat-icon>water_drop</mat-icon></span>
                  <mat-chip class="metric-chip" [class.chip-good]="humidStatus() === 'Comfortable'" [class.chip-warn]="humidStatus() === 'Dry' || humidStatus() === 'Humid'" [class.chip-alert]="humidStatus() === 'Very High'">
                    <span class="chip-dot"></span>{{ humidStatus() }}
                  </mat-chip>
                </div>
                <div class="metric-label">RELATIVE HUMIDITY</div>
                <div class="metric-reading">{{ currentReading() ? (currentReading()!.humidity | number:'1.1-1') : '—' }}<span>%</span></div>
                <div class="metric-foot">
                  <span>Comfort range</span><strong>40 — 60%</strong>
                </div>
                <mat-progress-bar mode="determinate" [value]="humidBarPercent()" aria-label="Humidity range"></mat-progress-bar>
              </mat-card-content>
            </mat-card>

            <mat-card class="metric-card update-card">
              <mat-card-content>
                <div class="metric-topline">
                  <span class="metric-icon update-icon"><mat-icon>schedule</mat-icon></span>
                  <mat-chip class="metric-chip update-chip"><span class="chip-dot"></span>15 min interval</mat-chip>
                </div>
                <div class="metric-label">LAST READING</div>
                <div class="last-reading">{{ formattedTimestamp() }}</div>
                <div class="metric-foot">
                  <span>Records received</span><strong>{{ readingHistory().length }} readings</strong>
                </div>
                <div class="update-track"><span [style.width.%]="readingHistory().length ? 100 : 8"></span></div>
              </mat-card-content>
            </mat-card>
          </section>

          <section class="insights-grid">
            <mat-card class="chart-card">
              <mat-card-content>
                <div class="section-heading chart-heading">
                  <div>
                    <div class="section-kicker">SENSOR TRENDS</div>
                    <h2>Temperature over time</h2>
                    <p>Recent readings from your ESP32 station</p>
                  </div>
                  <div class="chart-legend"><span></span> Temperature <b>°C</b></div>
                </div>
                <div class="chart-wrap">
                  @if (readingHistory().length) {
                    <div class="chart-y-labels"><span>40°</span><span>30°</span><span>20°</span><span>10°</span></div>
                    <svg class="temperature-chart" viewBox="0 0 1000 180" preserveAspectRatio="none" role="img" aria-label="Temperature trend for recent readings">
                      <defs>
                        <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stop-color="#6b74e8" stop-opacity=".22"></stop>
                          <stop offset="100%" stop-color="#6b74e8" stop-opacity="0"></stop>
                        </linearGradient>
                      </defs>
                      <line class="chart-gridline" x1="0" y1="20" x2="1000" y2="20"></line>
                      <line class="chart-gridline" x1="0" y1="60" x2="1000" y2="60"></line>
                      <line class="chart-gridline" x1="0" y1="100" x2="1000" y2="100"></line>
                      <line class="chart-gridline" x1="0" y1="140" x2="1000" y2="140"></line>
                      <path class="chart-area" [attr.d]="temperatureAreaPath()"></path>
                      <path class="chart-line" [attr.d]="temperatureChartPath()"></path>
                      @for (point of chartPoints(); track point.id) {
                        <circle class="chart-point" [attr.cx]="point.x" [attr.cy]="point.y" r="4"></circle>
                      }
                    </svg>
                  } @else {
                    <div class="chart-empty">
                      <span class="empty-graphic"><mat-icon>show_chart</mat-icon></span>
                      <strong>Your trend starts here</strong>
                      <span>Once your sensor sends its first reading, it’ll appear here.</span>
                    </div>
                  }
                </div>
                <div class="chart-axis"><span>{{ chartStartLabel() }}</span><span>Recent</span></div>
              </mat-card-content>
            </mat-card>

            <mat-card class="station-card">
              <mat-card-content>
                <div class="section-heading">
                  <div>
                    <div class="section-kicker">YOUR HARDWARE</div>
                    <h2>Sensor station</h2>
                  </div>
                  <button mat-icon-button matTooltip="ESP32 node status" aria-label="ESP32 node status"><mat-icon>more_horiz</mat-icon></button>
                </div>
                <div class="station-visual">
                  <div class="station-orbit orbit-one"></div>
                  <div class="station-orbit orbit-two"></div>
                  <div class="station-device"><mat-icon>sensors</mat-icon></div>
                  <span class="station-spark spark-one"></span><span class="station-spark spark-two"></span>
                </div>
                <div class="station-name"><strong>ESP32</strong><mat-chip class="node-chip">node_01</mat-chip></div>
                <p class="station-subtitle">Environmental sensor · DHT11</p>
                <div class="station-details">
                  <div><span><mat-icon>memory</mat-icon> Sensor</span><strong>DHT11</strong></div>
                  <div><span><mat-icon>schedule</mat-icon> Report interval</span><strong>15 minutes</strong></div>
                  <div><span><mat-icon>lan</mat-icon> Connection</span><strong [class.connection-good]="isConnected()">{{ isConnected() ? 'Live' : 'Waiting' }}</strong></div>
                </div>
              </mat-card-content>
            </mat-card>
          </section>

          <mat-card class="readings-card" id="readings">
            <mat-card-content>
              <div class="section-heading readings-heading">
                <div>
                  <div class="section-kicker">LIVE DATA</div>
                  <h2>Recent readings</h2>
                </div>
                <span class="reading-count"><span class="connection-dot" [class.connected]="isConnected()"></span>{{ readingHistory().length }} records</span>
              </div>
              @if (readingHistory().length) {
                <div class="table-scroll">
                  <table mat-table [dataSource]="readingHistory()" class="readings-table">
                    <ng-container matColumnDef="time">
                      <th mat-header-cell *matHeaderCellDef>TIME</th>
                      <td mat-cell *matCellDef="let reading">{{ formatTime(reading.timestamp) }}</td>
                    </ng-container>
                    <ng-container matColumnDef="node">
                      <th mat-header-cell *matHeaderCellDef>STATION</th>
                      <td mat-cell *matCellDef="let reading"><span class="table-node"><span class="table-node-dot"></span>{{ reading.nodeId || 'node_01' }}</span></td>
                    </ng-container>
                    <ng-container matColumnDef="temperature">
                      <th mat-header-cell *matHeaderCellDef>TEMPERATURE</th>
                      <td mat-cell *matCellDef="let reading"><span class="table-temperature">{{ reading.temperature | number:'1.1-1' }}<small>°C</small></span></td>
                    </ng-container>
                    <ng-container matColumnDef="humidity">
                      <th mat-header-cell *matHeaderCellDef>HUMIDITY</th>
                      <td mat-cell *matCellDef="let reading"><span class="table-humidity">{{ reading.humidity | number:'1.1-1' }}<small>%</small></span></td>
                    </ng-container>
                    <ng-container matColumnDef="condition">
                      <th mat-header-cell *matHeaderCellDef>CONDITION</th>
                      <td mat-cell *matCellDef="let reading">
                        <span class="condition-label" [class.condition-good]="reading.temperature >= 18 && reading.temperature <= 28">
                          <span></span>{{ reading.temperature < 18 ? 'Cool' : (reading.temperature > 28 ? 'Warm' : 'Comfortable') }}
                        </span>
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
                  </table>
                </div>
              } @else {
                <div class="readings-empty">
                  <span class="empty-graphic"><mat-icon>data_usage</mat-icon></span>
                  <strong>No readings yet</strong>
                  <span>Connect your ESP32 and Firebase to see your sensor data here.</span>
                </div>
              }
            </mat-card-content>
          </mat-card>

          <footer class="page-footer">
            <span>Made for the moments between measurements.</span>
            <span><span class="footer-status"></span>Data refreshes automatically</span>
          </footer>
        </div>
      </main>
    </div>
  `,
  styles: [`
    :host {
      --ink: #20233a;
      --muted: #898da3;
      --line: #ececf3;
      --violet: #686fe0;
      display: block;
      min-height: 100vh;
      color: var(--ink);
    }

    .app-layout { min-height: 100vh; display: grid; grid-template-columns: 248px minmax(0, 1fr); }
    .sidebar { position: sticky; top: 0; display: flex; flex-direction: column; height: 100vh; padding: 27px 17px 18px; background: #202239; color: #fff; }
    .brand { display: flex; align-items: center; gap: 12px; margin: 0 8px 55px; color: inherit; text-decoration: none; }
    .brand-mark { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 13px; color: white; background: linear-gradient(145deg, #858cf5, #6269d6); box-shadow: 0 6px 18px #13152966; }
    .brand-mark mat-icon { width: 23px; height: 23px; font-size: 23px; }
    .brand-copy { display: grid; gap: 3px; }
    .brand-copy strong { font-size: 17px; font-weight: 650; letter-spacing: -.3px; }
    .brand-copy small { color: #a7a9bf; font-size: 9px; font-weight: 650; letter-spacing: 1.55px; }
    .workspace-label, .section-kicker { color: #9da0b7; font-size: 10px; font-weight: 700; letter-spacing: 1.35px; }
    .workspace-label { padding: 0 12px; margin-bottom: 12px; }
    .side-nav { display: grid; gap: 5px; }
    .nav-link { display: flex; align-items: center; gap: 13px; min-height: 45px; padding: 0 12px; border-radius: 10px; color: #b6b8ca; text-decoration: none; font-size: 13px; font-weight: 550; transition: background .2s, color .2s; }
    .nav-link mat-icon { width: 19px; height: 19px; font-size: 19px; color: #999cb2; }
    .nav-link:hover, .nav-link.active { background: #32344f; color: white; }
    .nav-link.active mat-icon { color: #a8adff; }
    .nav-count { margin-left: auto; min-width: 24px; padding: 3px 6px; border-radius: 20px; background: #444663; color: #d6d7e5; text-align: center; font-size: 10px; }
    .sidebar-bottom { margin-top: auto; }
    .sidebar-node { display: flex; align-items: center; gap: 10px; padding: 14px 8px; border-top: 1px solid #ffffff14; border-bottom: 1px solid #ffffff14; }
    .node-icon { display: grid; place-items: center; width: 35px; height: 35px; border-radius: 11px; background: #363852; color: #b7bbff; }
    .node-icon mat-icon { font-size: 19px; }
    .node-copy { display: grid; gap: 5px; min-width: 0; }
    .node-copy strong { color: #e7e8f0; font-size: 11px; font-weight: 600; }
    .node-copy small { display: flex; align-items: center; gap: 6px; color: #a8aabd; font-size: 10px; }
    .tiny-dot, .connection-dot { width: 7px; height: 7px; border-radius: 50%; background: #b0b3c2; }
    .tiny-dot.online, .connection-dot.connected { background: #45c994; box-shadow: 0 0 0 3px #45c99420; }
    .more-icon { margin-left: auto; color: #888ba4; }
    .sidebar-footer { display: flex; align-items: center; gap: 9px; padding: 18px 4px 0; color: #bfc1d0; font-size: 11px; }
    .sidebar-footer mat-icon { margin-left: auto; font-size: 17px; color: #9194aa; }
    .avatar-small { display: grid; place-items: center; width: 27px; height: 27px; border-radius: 9px; background: #d8d8fb; color: #45478a; font-size: 12px; font-weight: 700; }

    .main-content { min-width: 0; background: #f7f7fb; }
    .topbar { position: sticky; z-index: 3; top: 0; display: flex; align-items: center; justify-content: space-between; min-height: 72px; padding: 0 clamp(22px, 4vw, 58px); border-bottom: 1px solid #eeeeF4; background: #ffffffed; backdrop-filter: blur(14px); }
    .breadcrumbs { display: flex; align-items: center; gap: 9px; color: #9a9daf; font-size: 12px; }
    .breadcrumbs mat-icon { width: 16px; height: 16px; font-size: 16px; }
    .breadcrumbs strong { color: #41445b; font-weight: 600; }
    .topbar-actions, .user-actions { display: flex; align-items: center; gap: 14px; }
    .connection-pill, .reading-count { display: inline-flex; align-items: center; gap: 8px; color: #888ba0; font-size: 11px; }
    .connection-pill { padding: 8px 11px; border: 1px solid #e8e9ef; border-radius: 20px; background: #fff; }
    .connection-pill.connected { color: #308c68; border-color: #d9f1e7; background: #f5fcf8; }
    .connection-pill.connected .connection-dot { background: #45c994; }
    .user-name { max-width: 150px; overflow: hidden; color: #595c71; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .user-avatar { width: 31px; height: 31px; border-radius: 50%; object-fit: cover; }
    .avatar-fallback { display: grid; place-items: center; background: #e9eaff; color: #555bc3; font-weight: 700; }
    .sign-in-button { border-radius: 9px; }
    .page-content { width: min(100%, 1440px); margin: 0 auto; padding: 37px clamp(22px, 4vw, 58px) 25px; }
    .notice-banner { display: flex; align-items: center; gap: 13px; margin-bottom: 23px; padding: 14px 16px; border: 1px solid #ebe4c8; border-radius: 12px; background: #fffcf2; color: #79703e; }
    .notice-banner > mat-icon { color: #b69a37; }
    .notice-banner div { display: grid; gap: 3px; }
    .notice-banner strong { color: #5e542b; font-size: 12px; }
    .notice-banner span { color: #81784c; font-size: 11px; }
    .notice-banner code { color: #665c32; font-size: 10px; }
    .error-banner { border-color: #f2d8d8; background: #fff8f8; color: #9b5252; }
    .error-banner > mat-icon { color: #c75050; }
    .error-banner div { flex: 1; }
    .error-banner strong { color: #893e3e; }
    .error-banner span { color: #9b5252; }
    .page-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 25px; }
    .eyebrow { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; color: #8689a0; font-size: 9px; font-weight: 700; letter-spacing: 1.6px; }
    .eyebrow-mark { width: 7px; height: 7px; border-radius: 2px; background: #777de6; transform: rotate(45deg); }
    .page-heading h1 { margin: 0; color: #262940; font-size: clamp(29px, 3.2vw, 39px); font-weight: 650; letter-spacing: -1.6px; line-height: 1.16; }
    .heading-period { color: #777de6; }
    .page-heading p { margin: 9px 0 0; color: #9092a4; font-size: 12px; }
    .heading-date { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border: 1px solid #ebebf1; border-radius: 9px; background: white; color: #73768c; font-size: 11px; white-space: nowrap; }
    .heading-date mat-icon { width: 15px; height: 15px; color: #999bb0; font-size: 15px; }

    .metric-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    .metric-card, .chart-card, .station-card, .readings-card { border: 1px solid #ededf3; border-radius: 14px; background: #fff; box-shadow: 0 4px 16px #2c315108; }
    .metric-card mat-card-content { padding: 18px 19px 16px; }
    .metric-topline { display: flex; align-items: center; justify-content: space-between; margin-bottom: 19px; }
    .metric-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 11px; }
    .metric-icon mat-icon { width: 20px; height: 20px; font-size: 20px; }
    .temperature-icon { background: #fff0ef; color: #e5847a; }
    .humidity-icon { background: #eaf5ff; color: #64a7d7; }
    .update-icon { background: #f0efff; color: #7d7de1; }
    .metric-chip { display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: 16px; background: #f2f2f7; color: #77798d; font-size: 9px; font-weight: 600; }
    .metric-chip .chip-dot { width: 5px; height: 5px; margin-right: 6px; border-radius: 50%; background: currentColor; }
    .chip-good { background: #eaf8f1; color: #398866; }
    .chip-warn { background: #fff6e8; color: #aa7a31; }
    .chip-alert { background: #fff0ef; color: #bb5c53; }
    .update-chip { background: #f2f1ff; color: #7675bf; }
    .metric-label { margin-bottom: 8px; color: #9092a4; font-size: 9px; font-weight: 700; letter-spacing: 1.15px; }
    .metric-reading { min-height: 54px; color: #292c43; font-size: 39px; font-weight: 620; letter-spacing: -1.6px; line-height: 1.15; }
    .metric-reading span { margin-left: 4px; color: #9698aa; font-size: 19px; font-weight: 450; letter-spacing: 0; }
    .last-reading { min-height: 54px; display: flex; align-items: center; color: #363951; font-size: 18px; font-weight: 600; letter-spacing: -.3px; }
    .metric-foot { display: flex; justify-content: space-between; gap: 8px; margin: 8px 0 12px; color: #a0a1b0; font-size: 10px; }
    .metric-foot strong { color: #73758a; font-size: 10px; font-weight: 600; }
    .metric-card mat-progress-bar { height: 4px; overflow: hidden; border-radius: 5px; --mdc-linear-progress-active-indicator-color: #e8877b; --mdc-linear-progress-track-color: #f8eae8; }
    .humidity-card mat-progress-bar { --mdc-linear-progress-active-indicator-color: #67acd8; --mdc-linear-progress-track-color: #e9f2f8; }
    .update-track { height: 4px; overflow: hidden; border-radius: 5px; background: #f0eff8; }
    .update-track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #8583ec, #b4a8f3); }

    .insights-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(265px, .8fr); gap: 16px; margin-top: 17px; }
    .chart-card mat-card-content, .station-card mat-card-content, .readings-card mat-card-content { padding: 20px; }
    .section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .section-heading h2 { margin: 6px 0 0; color: #30334a; font-size: 15px; font-weight: 650; letter-spacing: -.25px; }
    .section-heading p { margin: 5px 0 0; color: #9a9bac; font-size: 10px; }
    .section-kicker { color: #a0a1b1; font-size: 8px; letter-spacing: 1.35px; }
    .chart-heading { min-height: 61px; }
    .chart-legend { display: flex; align-items: center; gap: 6px; color: #9092a4; font-size: 10px; }
    .chart-legend > span { width: 7px; height: 7px; border-radius: 50%; background: #7478df; }
    .chart-legend b { margin-left: 3px; color: #b2b3c0; font-weight: 500; }
    .chart-wrap { position: relative; height: 166px; margin-top: 12px; }
    .chart-y-labels { position: absolute; z-index: 1; top: 0; bottom: 1px; left: 0; display: flex; flex-direction: column; justify-content: space-between; color: #a5a6b4; font-size: 9px; }
    .temperature-chart { position: absolute; inset: 0 0 0 36px; width: calc(100% - 36px); height: 100%; overflow: visible; }
    .chart-gridline { stroke: #f0f0f5; stroke-dasharray: 4 5; stroke-width: 1; }
    .chart-area { fill: url(#chartFill); }
    .chart-line { fill: none; stroke: #7478df; stroke-linecap: round; stroke-linejoin: round; stroke-width: 3; vector-effect: non-scaling-stroke; }
    .chart-point { fill: #fff; stroke: #7478df; stroke-width: 2.5; vector-effect: non-scaling-stroke; }
    .chart-axis { display: flex; justify-content: space-between; margin: 7px 0 0 36px; color: #a2a3b1; font-size: 9px; }
    .chart-empty { display: flex; height: 100%; flex-direction: column; align-items: center; justify-content: center; gap: 7px; padding: 12px; text-align: center; }
    .empty-graphic { display: grid; place-items: center; width: 38px; height: 38px; margin-bottom: 2px; border-radius: 12px; background: #f2f2ff; color: #8587d9; }
    .empty-graphic mat-icon { font-size: 20px; }
    .chart-empty strong, .readings-empty strong { color: #55586d; font-size: 11px; font-weight: 600; }
    .chart-empty > span:last-child, .readings-empty > span:last-child { max-width: 260px; color: #a0a1af; font-size: 10px; line-height: 1.55; }

    .station-card { overflow: hidden; }
    .station-card .section-heading { align-items: center; }
    .station-visual { position: relative; display: grid; height: 102px; place-items: center; margin: 12px 0 5px; overflow: hidden; border-radius: 12px; background: radial-gradient(ellipse at 50% 100%, #edeeff 0, #f8f8ff 48%, #fbfbfd 100%); }
    .station-orbit { position: absolute; width: 115px; height: 52px; border: 1px solid #e0e1fc; border-radius: 50%; }
    .orbit-one { transform: translateY(28px); }
    .orbit-two { width: 154px; transform: translateY(41px); border-color: #e8e8f8; }
    .station-device { z-index: 1; display: grid; width: 49px; height: 49px; place-items: center; border: 1px solid #e1e2fb; border-radius: 16px; background: #fff; color: #777ce1; box-shadow: 0 8px 20px #6669be1c; }
    .station-device mat-icon { width: 26px; height: 26px; font-size: 26px; }
    .station-spark { position: absolute; width: 5px; height: 5px; border-radius: 50%; background: #a2a5f4; }
    .spark-one { top: 27px; left: calc(50% - 47px); }
    .spark-two { top: 48px; right: calc(50% - 49px); width: 4px; height: 4px; background: #efb69a; }
    .station-name { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
    .station-name strong { color: #3d4057; font-size: 13px; font-weight: 650; }
    .node-chip { height: 20px; padding: 0 7px; border-radius: 6px; background: #f0f0ff; color: #7778c2; font-size: 9px; }
    .station-subtitle { margin: 4px 0 12px; color: #9b9cac; font-size: 10px; }
    .station-details { display: grid; gap: 9px; padding-top: 11px; border-top: 1px solid #f0f0f4; }
    .station-details > div { display: flex; align-items: center; justify-content: space-between; color: #9294a5; font-size: 10px; }
    .station-details > div > span { display: flex; align-items: center; gap: 7px; }
    .station-details mat-icon { width: 14px; height: 14px; color: #a3a4b2; font-size: 14px; }
    .station-details strong { color: #66697e; font-size: 10px; font-weight: 550; }
    .station-details .connection-good { color: #398866; }

    .readings-card { margin-top: 17px; }
    .readings-heading { align-items: center; margin-bottom: 13px; }
    .reading-count { padding: 7px 10px; border: 1px solid #ededf2; border-radius: 18px; background: #fcfcfd; color: #888a9d; font-size: 9px; }
    .reading-count .connection-dot { width: 6px; height: 6px; }
    .table-scroll { overflow-x: auto; }
    .readings-table { width: 100%; background: transparent; }
    .readings-table th { border-bottom-color: #f0f0f5; color: #a0a1b0; font-size: 8px; font-weight: 700; letter-spacing: 1px; }
    .readings-table td { border-bottom-color: #f3f3f7; color: #74768b; font-size: 10px; }
    .readings-table tr:last-child td { border-bottom: 0; }
    .readings-table .mat-column-time { min-width: 150px; }
    .readings-table .mat-column-node { min-width: 120px; }
    .readings-table .mat-column-condition { width: 145px; }
    .table-node { display: inline-flex; align-items: center; gap: 7px; color: #696c81; }
    .table-node-dot { width: 6px; height: 6px; border-radius: 2px; background: #8185e4; }
    .table-temperature, .table-humidity { color: #5f6279; font-weight: 600; }
    .table-temperature small, .table-humidity small { margin-left: 3px; color: #a2a3b1; font-size: 9px; font-weight: 450; }
    .table-humidity { color: #6592b4; }
    .condition-label { display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 15px; background: #fff6e9; color: #a77a37; font-size: 9px; }
    .condition-label > span { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
    .condition-good { background: #eaf8f1; color: #398866; }
    .readings-empty { display: flex; min-height: 165px; flex-direction: column; align-items: center; justify-content: center; gap: 7px; border-top: 1px solid #f1f1f5; text-align: center; }
    .page-footer { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 20px 2px 0; color: #aaaaba; font-size: 9px; }
    .page-footer > span:last-child { display: flex; align-items: center; gap: 7px; }
    .footer-status { width: 6px; height: 6px; border-radius: 50%; background: #8c8fe5; }

    @media (max-width: 1050px) {
      .app-layout { grid-template-columns: 210px minmax(0, 1fr); }
      .sidebar { padding-right: 13px; padding-left: 13px; }
      .insights-grid { grid-template-columns: minmax(0, 1.4fr) minmax(235px, .8fr); }
      .metric-card mat-card-content { padding-right: 15px; padding-left: 15px; }
      .metric-reading { font-size: 34px; }
    }
    @media (max-width: 780px) {
      .app-layout { display: block; }
      .sidebar { position: static; height: auto; padding: 13px 20px; }
      .brand { margin: 0; }
      .workspace-label, .side-nav, .sidebar-bottom { display: none; }
      .topbar { min-height: 60px; padding: 0 20px; }
      .page-content { padding: 28px 20px 20px; }
      .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .update-card { grid-column: span 2; }
      .update-card mat-card-content { display: grid; grid-template-columns: 1fr 1fr; column-gap: 18px; }
      .update-card .metric-topline { grid-column: 1 / -1; }
      .update-card .metric-foot, .update-card .update-track { align-self: end; }
      .insights-grid { grid-template-columns: 1fr; }
      .station-card mat-card-content { display: grid; grid-template-columns: minmax(170px, .7fr) minmax(180px, 1fr); column-gap: 16px; }
      .station-card .section-heading { grid-column: 1 / -1; }
      .station-visual { grid-row: span 3; }
      .station-name { align-self: end; }
      .station-subtitle { margin: 4px 0 8px; }
      .station-details { align-self: start; }
    }
    @media (max-width: 560px) {
      .topbar { padding: 0 15px; }
      .breadcrumbs span, .breadcrumbs mat-icon, .user-name { display: none; }
      .topbar-actions { gap: 8px; }
      .connection-pill { padding: 7px 9px; font-size: 10px; }
      .sign-in-button { min-width: 42px; }
      .page-content { padding: 24px 14px 18px; }
      .page-heading { align-items: flex-start; flex-direction: column; margin-bottom: 18px; }
      .page-heading h1 { font-size: 31px; }
      .heading-date { align-self: flex-start; }
      .metric-grid { grid-template-columns: 1fr; gap: 11px; }
      .update-card { grid-column: auto; }
      .update-card mat-card-content { display: block; }
      .insights-grid { gap: 11px; margin-top: 11px; }
      .chart-card mat-card-content, .station-card mat-card-content, .readings-card mat-card-content { padding: 16px; }
      .station-card mat-card-content { display: block; }
      .station-visual { height: 92px; }
      .station-name { margin-top: 10px; }
      .readings-card { margin-top: 11px; }
      .readings-table { min-width: 570px; }
      .page-footer { align-items: flex-start; flex-direction: column; gap: 8px; }
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private db: Database | null = null;
  private authStateUnsubscribe: Unsubscribe | null = null;
  private unsubscribeDb: Unsubscribe | null = null;

  readonly displayedColumns = ['time', 'node', 'temperature', 'humidity', 'condition'];
  readonly user = signal<User | null>(null);
  readonly isLoading = signal(false);
  readonly authError = signal<string | null>(null);
  readonly isConnected = signal(false);
  readonly currentReading = signal<TelemetryReading | null>(null);
  readonly readingHistory = signal<TelemetryReading[]>([]);
  readonly isPlaceholderConfig = computed(() =>
    environment.firebase.apiKey.includes('YOUR_API_KEY') ||
    environment.firebase.projectId === 'your-project-id'
  );
  readonly tempStatus = computed(() => {
    const temperature = this.currentReading()?.temperature;
    if (temperature === undefined) return 'No Signal';
    if (temperature < 18) return 'Cool';
    if (temperature <= 26) return 'Optimal';
    if (temperature <= 32) return 'Warm';
    return 'High';
  });
  readonly tempBadgeClass = computed(() => {
    switch (this.tempStatus()) {
      case 'Optimal': return 'badge-good';
      case 'Cool':
      case 'Warm': return 'badge-warn';
      case 'High': return 'badge-danger';
      default: return 'badge-neutral';
    }
  });
  readonly humidStatus = computed(() => {
    const humidity = this.currentReading()?.humidity;
    if (humidity === undefined) return 'No Signal';
    if (humidity < 30) return 'Dry';
    if (humidity <= 60) return 'Comfortable';
    if (humidity <= 75) return 'Humid';
    return 'Very High';
  });
  readonly humidBadgeClass = computed(() => {
    switch (this.humidStatus()) {
      case 'Comfortable': return 'badge-good';
      case 'Dry':
      case 'Humid': return 'badge-warn';
      case 'Very High': return 'badge-danger';
      default: return 'badge-neutral';
    }
  });
  readonly tempBarPercent = computed(() => {
    const temperature = this.currentReading()?.temperature;
    if (temperature === undefined) return 0;
    return Math.max(0, Math.min(100, ((temperature + 10) / 60) * 100));
  });
  readonly humidBarPercent = computed(() => {
    const humidity = this.currentReading()?.humidity;
    return humidity === undefined ? 0 : Math.max(0, Math.min(100, humidity));
  });
  readonly formattedTimestamp = computed(() => {
    const timestamp = this.currentReading()?.timestamp;
    return timestamp ? this.formatTime(timestamp) : 'Awaiting data';
  });
  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  });
  readonly todayLabel = computed(() =>
    new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())
  );
  readonly chartPoints = computed<ChartPoint[]>(() => {
    const oldestFirst = [...this.readingHistory()].reverse();
    return oldestFirst.map((reading, index) => ({
      id: reading.id ?? `${reading.timestamp}-${index}`,
      x: oldestFirst.length === 1 ? 500 : (index / (oldestFirst.length - 1)) * 1000,
      y: 160 - (Math.max(0, Math.min(40, reading.temperature)) / 40) * 140
    }));
  });
  readonly temperatureChartPath = computed(() =>
    this.chartPoints().map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  );
  readonly temperatureAreaPath = computed(() => {
    const points = this.chartPoints();
    if (!points.length) return '';
    return `${this.temperatureChartPath()} L ${points[points.length - 1].x} 170 L ${points[0].x} 170 Z`;
  });
  readonly chartStartLabel = computed(() => {
    const readings = this.readingHistory();
    const oldest = readings[readings.length - 1];
    return oldest ? this.formatTime(oldest.timestamp) : 'Waiting for first reading';
  });

  ngOnInit(): void {
    this.initializeFirebase();
  }

  ngOnDestroy(): void {
    this.authStateUnsubscribe?.();
    this.stopListeningToTelemetry();
  }

  async handleGoogleSignIn(): Promise<void> {
    if (!this.auth) {
      this.authError.set('Firebase is not configured. Add your project settings before signing in.');
      return;
    }

    this.isLoading.set(true);
    this.authError.set(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(this.auth, provider);
    } catch (error: unknown) {
      this.authError.set(this.getErrorMessage(error, 'Google sign-in failed.'));
    } finally {
      this.isLoading.set(false);
    }
  }

  async handleSignOut(): Promise<void> {
    if (!this.auth) return;
    this.authError.set(null);
    try {
      await signOut(this.auth);
    } catch (error: unknown) {
      this.authError.set(this.getErrorMessage(error, 'Sign out failed.'));
    }
  }

  formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime())
      ? 'Invalid Time'
      : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' }).format(date);
  }

  private initializeFirebase(): void {
    if (this.isPlaceholderConfig()) return;

    try {
      this.app = initializeApp(environment.firebase);
      this.auth = getAuth(this.app);
      this.db = getDatabase(this.app);
      this.authStateUnsubscribe = onAuthStateChanged(this.auth, (user) => {
        this.user.set(user);
        this.stopListeningToTelemetry();
        if (user) this.listenToTelemetry();
      }, (error) => {
        this.isConnected.set(false);
        this.authError.set(this.getErrorMessage(error, 'Unable to verify your Firebase sign-in.'));
      });
    } catch (error: unknown) {
      this.authError.set(this.getErrorMessage(error, 'Firebase could not be initialized.'));
    }
  }

  private listenToTelemetry(): void {
    if (!this.db || !this.user()) return;

    const readingsQuery = query(
      ref(this.db, environment.telemetryNodePath),
      limitToLast(20)
    );
    this.unsubscribeDb = onValue(readingsQuery, (snapshot) => {
      this.isConnected.set(true);
      const value: unknown = snapshot.val();
      if (!value || typeof value !== 'object') {
        this.readingHistory.set([]);
        this.currentReading.set(null);
        return;
      }

      const readings = Object.entries(value)
        .map(([id, entry]) => this.toTelemetryReading(id, entry))
        .filter((reading): reading is TelemetryReading => reading !== null)
        .sort((left, right) => right.timestamp - left.timestamp);
      this.readingHistory.set(readings);
      this.currentReading.set(readings[0] ?? null);
    }, (error) => {
      this.isConnected.set(false);
      this.authError.set(this.getErrorMessage(error, 'Unable to read telemetry from Firebase.'));
    });
  }

  private stopListeningToTelemetry(): void {
    this.unsubscribeDb?.();
    this.unsubscribeDb = null;
    this.isConnected.set(false);
    this.currentReading.set(null);
    this.readingHistory.set([]);
  }

  private toTelemetryReading(id: string, value: unknown): TelemetryReading | null {
    if (typeof value !== 'object' || value === null) return null;
    const reading = value as Record<string, unknown>;
    if (typeof reading['temperature'] !== 'number' || typeof reading['humidity'] !== 'number') return null;

    const timestamp = typeof reading['timestamp'] === 'number'
      ? reading['timestamp']
      : typeof reading['serverTime'] === 'number'
        ? reading['serverTime']
        : Date.now();
    return {
      id,
      nodeId: typeof reading['nodeId'] === 'string' ? reading['nodeId'] : 'node_01',
      temperature: reading['temperature'],
      humidity: reading['humidity'],
      timestamp
    };
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}
