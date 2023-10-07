#include "utils.h"

namespace nodeml_torch
{

    template <typename T>
    std::vector<T> NapiArrayToVector(Napi::Array &arr)
    {
        std::vector<T> result;

        for (int i = 0; i < arr.Length(); i++)
        {
            result.push_back(arr.Get(i).As<Napi::Number>().Int64Value());
        }

        return result;
    }

    template <>
    std::vector<std::int64_t> NapiArrayToVector(Napi::Array &arr)
    {
        std::vector<std::int64_t> result;

        for (int i = 0; i < arr.Length(); i++)
        {
            result.push_back(arr.Get(i).As<Napi::Number>().Int64Value());
        }

        return result;
    }

    template <>
    std::vector<float> NapiArrayToVector(Napi::Array &arr)
    {
        std::vector<float> result;

        for (int i = 0; i < arr.Length(); i++)
        {
            result.push_back(arr.Get(i).As<Napi::Number>().FloatValue());
        }

        return result;
    }

    template <>
    std::vector<double> NapiArrayToVector(Napi::Array &arr)
    {
        std::vector<double> result;

        for (int i = 0; i < arr.Length(); i++)
        {
            result.push_back(arr.Get(i).As<Napi::Number>().DoubleValue());
        }

        return result;
    }

    template <typename T>
    std::vector<T> VectorToNapiArray(const Napi::CallbackInfo &info)
    {
        return std::vector<T>;
    }
}