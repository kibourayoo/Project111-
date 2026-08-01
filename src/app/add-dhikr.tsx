import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useFonts, Cairo_700Bold } from '@expo-google-fonts/cairo';
import PageHeader from '@/components/PageHeader';
import { useAdhkar } from '@/lib/adhkar-context';

const BG      = '#FDFBF7';
const TEXT    = '#1A1A1A';
const MUTED   = '#999999';
const BORDER  = '#D8D4CC';
const ERROR   = '#C0392B';
const PRIMARY = '#4A7C59';

export default function AddDhikrScreen() {
  const [fontsLoaded] = useFonts({ Cairo_700Bold });
  const { adhkar, setAdhkar } = useAdhkar();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('الرجاء إدخال ذكر.');
      return;
    }
    setAdhkar([...adhkar, trimmed]);
    router.back();
  };

  const handleCancel = () => {
    router.back();
  };

  const fontFamily = fontsLoaded ? 'Cairo_700Bold' : undefined;

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, backgroundColor: BG }}>
        <StatusBar style="dark" backgroundColor={BG} />

        {/* ─── شريط العنوان ─── */}
        <PageHeader title="إضافة ذكر" onBack={handleCancel} />

        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, gap: 28 }}
        >
          {/* ─── حقل الذكر ─── */}
          <View style={{ gap: 8 }}>
            <Text style={{
              fontSize: 14,
              color: MUTED,
              fontFamily,
              textAlign: 'right',
            }}>
              اسم الذكر
            </Text>
            <TextInput
              value={name}
              onChangeText={(v) => { setName(v); setError(''); }}
              placeholder="اكتب الذكر الجديد هنا..."
              placeholderTextColor={MUTED}
              textAlign="right"
              multiline
              textAlignVertical="top"
              style={{
                fontFamily,
                fontSize: 18,
                color: TEXT,
                borderWidth: 1,
                borderColor: error ? ERROR : BORDER,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingTop: 14,
                paddingBottom: 14,
                backgroundColor: '#FEFCF8',
                height: 185,
                writingDirection: 'rtl',
                outlineWidth: 0,
              }}
            />
            {/* رسالة الخطأ */}
            {!!error && (
              <Text style={{ fontSize: 13, color: ERROR, textAlign: 'right', fontFamily }}>
                {error}
              </Text>
            )}
          </View>

          {/* ─── الأزرار في صف واحد ─── */}
          <View style={{ flexDirection: 'row', gap: 14 }}>
            {/* إلغاء — يسار */}
            <Pressable
              onPress={handleCancel}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: BORDER,
                borderRadius: 12,
                height: 54,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: BG,
              }}
            >
              <Text style={{ fontFamily, fontSize: 16, color: MUTED }}>
                إلغاء
              </Text>
            </Pressable>

            {/* حفظ — يمين */}
            <Pressable
              onPress={handleSave}
              disabled={!name.trim()}
              style={{
                flex: 1,
                backgroundColor: name.trim() ? PRIMARY : '#A8C4B0',
                borderRadius: 12,
                height: 54,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{
                fontFamily,
                fontSize: 16,
                color: '#FFFFFF',
                fontWeight: fontsLoaded ? undefined : 'bold',
              }}>
                حفظ
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
