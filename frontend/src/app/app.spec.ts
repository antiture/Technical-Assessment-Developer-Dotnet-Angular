import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders primary navigation and router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('nav[aria-label="Navigation principale"]')).toBeTruthy();
    expect(html.querySelector('a[routerLink="/users"]') ?? html.querySelector('a[href="/users"]')).toBeTruthy();
    expect(html.querySelector('router-outlet')).toBeTruthy();
    expect(html.querySelector('app-nx-welcome')).toBeNull();
  });
});
