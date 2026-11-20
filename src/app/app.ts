import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AppStore } from './core/app-store';
import { IconComponent } from './shared/icon';
import { SchoolCrestComponent } from './shared/emblems';
import { A4ImpositionSheetComponent } from './shared/a4-imposition-sheet';
import { StudentWorkshopComponent } from './student/student-workshop';
import { TeacherDashboardComponent } from './teacher/teacher-dashboard';

/** 臺南一中 105 歲校慶國文科成果展｜一頁府城・百年書籤 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    SchoolCrestComponent,
    A4ImpositionSheetComponent,
    StudentWorkshopComponent,
    TeacherDashboardComponent,
  ],
  templateUrl: './app.html',
})
export class App {
  protected readonly store = inject(AppStore);

  protected readonly showPasscodeModal = signal(
    this.store.urlParams.mode === 'teacher' && Boolean(this.store.teacherPasscode()),
  );
  protected readonly passcodeAttempt = signal('');
  protected readonly passcodeError = signal('');

  protected onCrestDoubleClick(): void {
    if (!this.store.isForcedStudentMode && this.store.activeView() === 'student') {
      this.enterTeacherView();
    }
  }

  protected enterTeacherView(): void {
    if (!this.store.teacherPasscode()) {
      this.store.activeView.set('teacher');
      return;
    }
    this.passcodeAttempt.set('');
    this.passcodeError.set('');
    this.showPasscodeModal.set(true);
  }

  protected verifyPasscode(event: Event): void {
    event.preventDefault();
    if (this.passcodeAttempt().trim() === this.store.teacherPasscode()) {
      this.showPasscodeModal.set(false);
      this.store.activeView.set('teacher');
      this.store.showToast('已驗證進入教師管理與 A4 拼版列印後台。');
    } else {
      this.passcodeError.set('驗證碼不正確，請重新輸入。');
    }
  }

  protected val(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
