import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { ArrowLeft, BookOpen, ChevronLeft } from 'lucide-react-native';
import PageHeader from '@/components/PageHeader';

const BG      = '#FDFBF7';
const TEXT    = '#1A1A1A';
const MUTED   = '#999999';
const DIVIDER = '#E8E4DC';

export default function SubhaSettingsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" backgroundColor={BG} />

      {/* ─── شريط العنوان ─── */}
      <PageHeader title="إعدادات السبحة" />

      {/* ─── قائمة الإعدادات ─── */}
      <View style={{ marginTop: 16 }}>
        {/* إدارة الأذكار */}
        <Pressable
          onPress={() => router.push('/adhkar-manager' as never)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 16,
            gap: 14,
          }}
        >
          <ChevronLeft size={18} color={MUTED} />
          <Text style={{ flex: 1, fontSize: 16, color: TEXT }}>إدارة الأذكار</Text>
          <BookOpen size={20} color={MUTED} />
        </Pressable>
        <View style={{ height: 1, backgroundColor: DIVIDER, marginHorizontal: 20 }} />
      </View>
    </View>
  );
}
