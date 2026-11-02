package by.skanvordy.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import java.util.Calendar;

/** Ежедневное напоминание «Новый сканворд дня готов» в выбранное время. */
public class Daily extends BroadcastReceiver {
    static final String CH = "daily";
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("skan", Context.MODE_PRIVATE); }

    static void schedule(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = PendingIntent.getBroadcast(c, 1, new Intent(c, Daily.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.cancel(pi);
        String time = prefs(c).getString("time", "");
        if (time.isEmpty()) return;
        try {
            String[] hm = time.split(":");
            Calendar t = Calendar.getInstance();
            t.set(Calendar.HOUR_OF_DAY, Integer.parseInt(hm[0])); t.set(Calendar.MINUTE, Integer.parseInt(hm[1]));
            t.set(Calendar.SECOND, 0); t.set(Calendar.MILLISECOND, 0);
            if (t.getTimeInMillis() <= System.currentTimeMillis() + 1000) t.add(Calendar.DAY_OF_YEAR, 1);
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t.getTimeInMillis(), pi);
        } catch (Exception ignored) { }
    }

    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CH, "Сканворд дня", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Напоминание о новом сканворде дня");
            ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(ch);
        }
    }

    @Override public void onReceive(Context c, Intent in) {
        try {
            ensureChannel(c);
            Intent open = new Intent(c, MainActivity.class).putExtra("url", MainActivity.HOME + "?play=daily")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pi = PendingIntent.getActivity(c, 90, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification.Builder nb = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CH) : new Notification.Builder(c);
            nb.setSmallIcon(R.drawable.ic_notify).setContentTitle("🧩 Новый сканворд дня готов")
              .setContentText("Решите его и сравните время с друзьями")
              .setContentIntent(pi).setAutoCancel(true).setColor(0xff1D3A7A);
            ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(900, nb.build());
        } catch (Exception ignored) { }
        finally { schedule(c); }
    }

    /** Восстанавливает напоминание после перезагрузки телефона или обновления приложения. */
    public static class Boot extends BroadcastReceiver {
        @Override public void onReceive(Context c, Intent i) { schedule(c); }
    }
}
