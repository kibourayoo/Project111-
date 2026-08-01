/**
 * شاشة Debug معزولة — اختبار Expo Sensors مباشرة
 *
 * ⚠️ لا تستورد أي شيء من lib/qibla
 * هدفها الوحيد: إثبات هل expo-sensors يعمل أم لا
 */

import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { Magnetometer, DeviceMotion } from 'expo-sensors';
import type { MagnetometerMeasurement, DeviceMotionMeasurement } from 'expo-sensors';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';

// ─── أنواع محلية ───────────────────────────────────────────────────────────────
type TestState = 'idle' | 'running' | 'done';

// ─── مكوّن قسم ──────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mx-4 mb-4 bg-white rounded-2xl p-4"
      style={{ borderCurve: 'continuous', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
      <Text className="text-xs font-bold text-[#8B7355] uppercase mb-3 tracking-widest">{title}</Text>
      {children}
    </View>
  );
}

// ─── صف معلومة ──────────────────────────────────────────────────────────────────
function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View className="flex-row justify-between items-center py-1 border-b border-[#F0EBE3]">
      <Text className="text-sm text-[#8B7355]">{label}</Text>
      <Text className={`text-sm font-bold ${highlight ? 'text-green-600' : 'text-[#3D2B1A]'}`}>{value}</Text>
    </View>
  );
}

// ─── الشاشة الرئيسية ─────────────────────────────────────────────────────────────
export default function SensorDebugScreen() {
  // ── حالة البيئة ──
  const [envReady, setEnvReady] = useState(false);

  // ── نتيجة isAvailableAsync ──
  const [magAvailable, setMagAvailable]     = useState<boolean | null>(null);
  const [motionAvailable, setMotionAvailable] = useState<boolean | null>(null);
  const [magError, setMagError]             = useState<string | null>(null);
  const [motionError, setMotionError]       = useState<string | null>(null);

  // ── قراءات Magnetometer ──
  const [magState, setMagState] = useState<TestState>('idle');
  const [mag, setMag]           = useState<MagnetometerMeasurement | null>(null);
  const [magCount, setMagCount] = useState(0);
  const [magChanging, setMagChanging] = useState(false);
  const prevMagRef = useRef<MagnetometerMeasurement | null>(null);

  // ── قراءات DeviceMotion ──
  const [dmState, setDmState] = useState<TestState>('idle');
  const [dm, setDm]           = useState<DeviceMotionMeasurement | null>(null);
  const [dmCount, setDmCount] = useState(0);

  // ── cleanup refs ──
  const magSubRef    = useRef<ReturnType<typeof Magnetometer.addListener> | null>(null);
  const dmSubRef     = useRef<ReturnType<typeof DeviceMotion.addListener> | null>(null);

  // ── التحقق من isAvailable عند mount ──
  useEffect(() => {
    (async () => {
      // Magnetometer
      try {
        const r = await Magnetometer.isAvailableAsync();
        setMagAvailable(r);
      } catch (e) {
        setMagAvailable(false);
        setMagError(e instanceof Error ? e.message : String(e));
      }
      // DeviceMotion
      try {
        const r = await DeviceMotion.isAvailableAsync();
        setMotionAvailable(r);
      } catch (e) {
        setMotionAvailable(false);
        setMotionError(e instanceof Error ? e.message : String(e));
      }
      setEnvReady(true);
    })();

    return () => {
      magSubRef.current?.remove();
      dmSubRef.current?.remove();
    };
  }, []);

  // ── بدء Magnetometer ──
  function startMagnetometer() {
    if (magState === 'running') return;
    setMagState('running');
    setMagCount(0);
    Magnetometer.setUpdateInterval(200);
    magSubRef.current = Magnetometer.addListener((data) => {
      setMag(data);
      setMagCount((c) => c + 1);
      // هل القيم تتغير؟
      if (prevMagRef.current) {
        const dx = Math.abs(data.x - prevMagRef.current.x);
        const dy = Math.abs(data.y - prevMagRef.current.y);
        setMagChanging(dx > 0.5 || dy > 0.5);
      }
      prevMagRef.current = data;
    });
  }

  // ── إيقاف Magnetometer ──
  function stopMagnetometer() {
    magSubRef.current?.remove();
    magSubRef.current = null;
    setMagState('done');
  }

  // ── بدء DeviceMotion ──
  function startDeviceMotion() {
    if (dmState === 'running') return;
    setDmState('running');
    setDmCount(0);
    DeviceMotion.setUpdateInterval(200);
    dmSubRef.current = DeviceMotion.addListener((data) => {
      setDm(data);
      setDmCount((c) => c + 1);
    });
  }

  // ── إيقاف DeviceMotion ──
  function stopDeviceMotion() {
    dmSubRef.current?.remove();
    dmSubRef.current = null;
    setDmState('done');
  }

  // ── تنسيق رقم ──
  const fmt = (v: number | null | undefined) =>
    v == null ? '—' : v.toFixed(4);

  const boolLabel = (v: boolean | null) =>
    v === null ? '…' : v ? '✅  true' : '❌  false';

  return (
    <ScrollView
      className="flex-1 bg-[#FDFBF7]"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="pb-12 pt-4"
    >
      <StatusBar style="dark" backgroundColor="#FDFBF7" />

      {/* ── عنوان ── */}
      <View className="items-center mb-6 px-4">
        <Text className="text-2xl font-bold text-[#3D2B1A]">🔬 Sensor Debug</Text>
        <Text className="text-xs text-[#8B7355] mt-1">
          اختبار معزول — بدون أي كود من lib/qibla
        </Text>
      </View>

      {/* ── بيئة التشغيل ── */}
      <Section title="بيئة التشغيل">
        <InfoRow label="Platform.OS"                   value={Platform.OS} />
        <InfoRow label="process.env.EXPO_OS"           value={String(process.env.EXPO_OS ?? 'undefined')} />
        <InfoRow label="Device.isDevice"               value={String(Device.isDevice)} />
        <InfoRow label="Constants.executionEnvironment" value={String(Constants.executionEnvironment ?? 'undefined')} />
        <InfoRow label="expo-sensors"                  value="~55.0.16" />
        <InfoRow label="expo-location"                 value="~55.1.11" />
        <InfoRow label="expo SDK"                      value={String(Constants.expoConfig?.sdkVersion ?? Constants.manifest?.sdkVersion ?? '—')} />
      </Section>

      {/* ── isAvailableAsync ── */}
      <Section title="isAvailableAsync — نتيجة مباشرة">
        {!envReady ? (
          <Text className="text-sm text-[#8B7355]">جارٍ التحقق…</Text>
        ) : (
          <>
            <InfoRow
              label="Magnetometer.isAvailableAsync()"
              value={boolLabel(magAvailable)}
              highlight={magAvailable === true}
            />
            {magError && (
              <Text className="text-xs text-red-500 mt-1">خطأ: {magError}</Text>
            )}
            <InfoRow
              label="DeviceMotion.isAvailableAsync()"
              value={boolLabel(motionAvailable)}
              highlight={motionAvailable === true}
            />
            {motionError && (
              <Text className="text-xs text-red-500 mt-1">خطأ: {motionError}</Text>
            )}
          </>
        )}
      </Section>

      {/* ── Magnetometer Live ── */}
      <Section title="Magnetometer — قراءات مباشرة (x / y / z)">
        <View className="flex-row gap-2 mb-3">
          <Pressable
            onPress={startMagnetometer}
            className={`flex-1 py-2 rounded-xl items-center ${magState === 'running' ? 'bg-[#E8DDD0]' : 'bg-[#C5A96A]'}`}
          >
            <Text className={`font-bold text-sm ${magState === 'running' ? 'text-[#8B7355]' : 'text-white'}`}>
              {magState === 'running' ? '🔴  يعمل…' : '▶  بدء'}
            </Text>
          </Pressable>
          <Pressable
            onPress={stopMagnetometer}
            className="flex-1 py-2 rounded-xl items-center bg-[#E8DDD0]"
          >
            <Text className="font-bold text-sm text-[#5C4A2A]">⏹  إيقاف</Text>
          </Pressable>
        </View>

        <InfoRow label="عدد القراءات" value={String(magCount)} />
        <InfoRow label="x" value={fmt(mag?.x)} />
        <InfoRow label="y" value={fmt(mag?.y)} />
        <InfoRow label="z" value={fmt(mag?.z)} />
        <InfoRow
          label="هل القيم تتغير؟"
          value={magState === 'idle' ? '— ابدأ أولاً' : magChanging ? '✅  نعم — يتحرك' : '⚠️  ثابتة'}
          highlight={magChanging}
        />
      </Section>

      {/* ── DeviceMotion Live ── */}
      <Section title="DeviceMotion — rotation (pitch / roll / yaw)">
        <View className="flex-row gap-2 mb-3">
          <Pressable
            onPress={startDeviceMotion}
            className={`flex-1 py-2 rounded-xl items-center ${dmState === 'running' ? 'bg-[#E8DDD0]' : 'bg-[#C5A96A]'}`}
          >
            <Text className={`font-bold text-sm ${dmState === 'running' ? 'text-[#8B7355]' : 'text-white'}`}>
              {dmState === 'running' ? '🔴  يعمل…' : '▶  بدء'}
            </Text>
          </Pressable>
          <Pressable
            onPress={stopDeviceMotion}
            className="flex-1 py-2 rounded-xl items-center bg-[#E8DDD0]"
          >
            <Text className="font-bold text-sm text-[#5C4A2A]">⏹  إيقاف</Text>
          </Pressable>
        </View>

        <InfoRow label="عدد القراءات" value={String(dmCount)} />
        <InfoRow label="alpha (دوران Z)" value={fmt(dm?.rotation?.alpha)} />
        <InfoRow label="beta  (دوران X)" value={fmt(dm?.rotation?.beta)} />
        <InfoRow label="gamma (دوران Y)" value={fmt(dm?.rotation?.gamma)} />
      </Section>

      {/* ── الخلاصة التلقائية ── */}
      {envReady && (
        <Section title="الخلاصة التلقائية">
          {magAvailable === false && (
            <View className="bg-red-50 rounded-xl p-3 mb-2">
              <Text className="text-sm font-bold text-red-700">
                ❌  Magnetometer.isAvailableAsync() = false
              </Text>
              <Text className="text-xs text-red-600 mt-1">
                {magError
                  ? `استثناء: ${magError}`
                  : 'إما الجهاز لا يحتوي مستشعر، أو البيئة Web/Emulator، أو الموديول النيتف لم يُحمَّل.'}
              </Text>
            </View>
          )}
          {magAvailable === true && magState === 'idle' && (
            <View className="bg-blue-50 rounded-xl p-3 mb-2">
              <Text className="text-sm font-bold text-blue-700">
                ✅  المستشعر متاح — اضغط "بدء" لرؤية القراءات
              </Text>
            </View>
          )}
          {magAvailable === true && magState !== 'idle' && magCount === 0 && (
            <View className="bg-amber-50 rounded-xl p-3 mb-2">
              <Text className="text-sm font-bold text-amber-700">
                ⚠️  isAvailable = true لكن لا قراءات
              </Text>
              <Text className="text-xs text-amber-600 mt-1">
                addListener يعمل لكن لا يُطلق أحداث — مشكلة في الـ Subscription
              </Text>
            </View>
          )}
          {magAvailable === true && magCount > 0 && !magChanging && (
            <View className="bg-amber-50 rounded-xl p-3 mb-2">
              <Text className="text-sm font-bold text-amber-700">
                ⚠️  قراءات موجودة لكن ثابتة — حرّك الهاتف
              </Text>
              <Text className="text-xs text-amber-600 mt-1">
                القيم ثابتة رغم وجود اشتراك — سيتضح عند تحريك الجهاز
              </Text>
            </View>
          )}
          {magAvailable === true && magCount > 0 && magChanging && (
            <View className="bg-green-50 rounded-xl p-3">
              <Text className="text-sm font-bold text-green-700">
                ✅  Magnetometer يعمل بشكل كامل — المشكلة في محرك القبلة
              </Text>
            </View>
          )}
        </Section>
      )}
    </ScrollView>
  );
}
