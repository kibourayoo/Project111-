import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useFonts, Cairo_700Bold } from '@expo-google-fonts/cairo';
import { GripVertical, Plus, Trash2 } from 'lucide-react-native';
import PageHeader from '@/components/PageHeader';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAdhkar } from '@/lib/adhkar-context';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const BG       = '#FDFBF7';
const TEXT     = '#1A1A1A';
const MUTED    = '#AAAAAA';
const DIVIDER  = '#E8E4DC';
const DELETE_RED = '#E74C3C';
const ITEM_H   = 57;
const MAX_ITEMS = 10;

export default function AdhkarManagerScreen() {
  const [fontsLoaded] = useFonts({ Cairo_700Bold });
  const { adhkar, setAdhkar } = useAdhkar();
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState<number | null>(null);

  /* ── SharedValues للحركة الرأسية (إعادة الترتيب) ── */
  const ty0 = useSharedValue(0); const ty1 = useSharedValue(0);
  const ty2 = useSharedValue(0); const ty3 = useSharedValue(0);
  const ty4 = useSharedValue(0); const ty5 = useSharedValue(0);
  const ty6 = useSharedValue(0); const ty7 = useSharedValue(0);
  const ty8 = useSharedValue(0); const ty9 = useSharedValue(0);
  const tyArr = [ty0, ty1, ty2, ty3, ty4, ty5, ty6, ty7, ty8, ty9];

  const active = useSharedValue(-1);

  /* ── أنماط الحركة ── */
  const anim0 = useAnimatedStyle(() => ({ transform: [{ translateY: ty0.value }], zIndex: active.value === 0 ? 10 : 1, backgroundColor: active.value === 0 ? '#F0EDE6' : BG }));
  const anim1 = useAnimatedStyle(() => ({ transform: [{ translateY: ty1.value }], zIndex: active.value === 1 ? 10 : 1, backgroundColor: active.value === 1 ? '#F0EDE6' : BG }));
  const anim2 = useAnimatedStyle(() => ({ transform: [{ translateY: ty2.value }], zIndex: active.value === 2 ? 10 : 1, backgroundColor: active.value === 2 ? '#F0EDE6' : BG }));
  const anim3 = useAnimatedStyle(() => ({ transform: [{ translateY: ty3.value }], zIndex: active.value === 3 ? 10 : 1, backgroundColor: active.value === 3 ? '#F0EDE6' : BG }));
  const anim4 = useAnimatedStyle(() => ({ transform: [{ translateY: ty4.value }], zIndex: active.value === 4 ? 10 : 1, backgroundColor: active.value === 4 ? '#F0EDE6' : BG }));
  const anim5 = useAnimatedStyle(() => ({ transform: [{ translateY: ty5.value }], zIndex: active.value === 5 ? 10 : 1, backgroundColor: active.value === 5 ? '#F0EDE6' : BG }));
  const anim6 = useAnimatedStyle(() => ({ transform: [{ translateY: ty6.value }], zIndex: active.value === 6 ? 10 : 1, backgroundColor: active.value === 6 ? '#F0EDE6' : BG }));
  const anim7 = useAnimatedStyle(() => ({ transform: [{ translateY: ty7.value }], zIndex: active.value === 7 ? 10 : 1, backgroundColor: active.value === 7 ? '#F0EDE6' : BG }));
  const anim8 = useAnimatedStyle(() => ({ transform: [{ translateY: ty8.value }], zIndex: active.value === 8 ? 10 : 1, backgroundColor: active.value === 8 ? '#F0EDE6' : BG }));
  const anim9 = useAnimatedStyle(() => ({ transform: [{ translateY: ty9.value }], zIndex: active.value === 9 ? 10 : 1, backgroundColor: active.value === 9 ? '#F0EDE6' : BG }));
  const animArr = [anim0, anim1, anim2, anim3, anim4, anim5, anim6, anim7, anim8, anim9];

  /* ── إعادة الترتيب ── */
  const reorder = (fromIdx: number, steps: number) => {
    if (steps === 0) return;
    const toIdx = Math.max(0, Math.min(adhkar.length - 1, fromIdx + steps));
    if (toIdx === fromIdx) return;
    const next = [...adhkar];
    const [item] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, item);
    setAdhkar(next);
  };

  /* ── إيماءة إعادة الترتيب (على أيقونة ☰ فقط) ── */
  const makeDragGesture = (idx: number) => {
    if (idx >= MAX_ITEMS) return Gesture.Tap();
    const ty = tyArr[idx];

    const longPress = Gesture.LongPress()
      .minDuration(350)
      .onStart(() => {
        active.value = idx;
        ty.value = 0;
      });

    const pan = Gesture.Pan()
      .onUpdate((e) => {
        if (active.value === idx) ty.value = e.translationY;
      })
      .onEnd(() => {
        if (active.value !== idx) return;
        const steps = Math.round(ty.value / ITEM_H);
        runOnJS(reorder)(idx, steps);
        ty.value = withSpring(0, { duration: 200 });
        active.value = -1;
      })
      .onFinalize(() => {
        if (active.value === idx) {
          ty.value = withSpring(0, { duration: 200 });
          active.value = -1;
        }
      });

    return Gesture.Simultaneous(longPress, pan);
  };

  /* ── إغلاق نافذة الحذف ── */
  const closeDeleteDialog = () => setPendingDeleteIdx(null);

  /* ── تأكيد الحذف ── */
  const confirmDelete = () => {
    if (pendingDeleteIdx === null) return;
    setAdhkar(adhkar.filter((_, i) => i !== pendingDeleteIdx));
    setPendingDeleteIdx(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" backgroundColor={BG} />

      {/* ─── شريط العنوان ─── */}
      <PageHeader
        title="إدارة الأذكار"
        right={
          <Pressable onPress={() => router.push('/add-dhikr' as never)} style={{ padding: 8, marginRight: -8 }}>
            <Plus size={22} color={TEXT} />
          </Pressable>
        }
      />

      {/* ─── قائمة الأذكار ─── */}
      <View style={{ overflow: 'visible' }}>
        {adhkar.map((item, idx) => (
          <Animated.View
            key={`${item}-${idx}`}
            style={[{ overflow: 'visible' }, animArr[idx] ?? {}]}
          >
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              paddingRight: 20, gap: 4,
            }}>

              {/* 🗑️ زر الحذف الثابت */}
              {adhkar.length > 1 && (
                <Pressable
                  onPress={() => setPendingDeleteIdx(idx)}
                  style={{ paddingHorizontal: 12, paddingVertical: 18 }}
                >
                  <Trash2 size={20} color={DELETE_RED} />
                </Pressable>
              )}
              {adhkar.length === 1 && (
                /* مساحة بديلة للحفاظ على الاتساق البصري */
                <View style={{ width: 44 }} />
              )}

              {/* ☰ مقبض إعادة الترتيب */}
              <GestureDetector gesture={makeDragGesture(idx)}>
                <View style={{ paddingHorizontal: 8, paddingVertical: 18 }}>
                  <GripVertical size={20} color={MUTED} />
                </View>
              </GestureDetector>

              {/* نص الذكر — قابل للضغط للتعديل */}
              <Pressable
                onPress={() => router.push({ pathname: '/edit-dhikr', params: { idx: String(idx) } } as never)}
                style={{ flex: 1, paddingVertical: 18 }}
              >
                <Text style={{
                  fontFamily: fontsLoaded ? 'Cairo_700Bold' : undefined,
                  fontWeight: fontsLoaded ? undefined : 'bold',
                  fontSize: 18, color: TEXT, textAlign: 'right',
                }}>
                  {item}
                </Text>
              </Pressable>
            </View>

            {idx < adhkar.length - 1 && (
              <View style={{ height: 1, backgroundColor: DIVIDER, marginHorizontal: 20 }} />
            )}
          </Animated.View>
        ))}
      </View>

      {/* ─── نافذة تأكيد الحذف ─── */}
      <AlertDialog open={pendingDeleteIdx !== null} onOpenChange={(open) => { if (!open) closeDeleteDialog(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الذكر</AlertDialogTitle>
            <AlertDialogDescription>هل تريد حذف هذا الذكر؟</AlertDialogDescription>
          </AlertDialogHeader>
          {pendingDeleteIdx !== null && (
            <Text style={{
              fontFamily: fontsLoaded ? 'Cairo_700Bold' : undefined,
              fontSize: 16, color: TEXT, textAlign: 'center',
              paddingHorizontal: 8, paddingBottom: 4,
            }}>
              {adhkar[pendingDeleteIdx]}
            </Text>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onPress={closeDeleteDialog}>إلغاء</AlertDialogCancel>
            <Pressable
              onPress={confirmDelete}
              className="bg-destructive rounded-lg h-10 px-4 items-center justify-center active:opacity-80"
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>حذف</Text>
            </Pressable>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
